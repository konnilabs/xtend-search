"""Private incremental adapter. Engines, plugins and final ranking remain upstream-owned."""
import copy
import json
import queue
import threading

from flask import Response, copy_current_request_context, stream_with_context
from searx.results import ResultContainer, calculate_score
from searx.webutils import get_json_response
from searx.xtend_integration import enrich_response


class SnapshotContainer(ResultContainer):
    def __init__(self, publish, stopped):
        super().__init__()
        self.publish = publish
        self.stopped = stopped

    def extend(self, engine_name, results):
        # Serialize complete engine batches, including plugin filtering, before copying.
        with self._lock:
            if self.stopped.is_set() or self._closed:
                return
            super().extend(engine_name, results)
            if self.main_results_map or self.infoboxes:
                self.publish(self.snapshot())

    def snapshot(self):
        with self._lock:
            snapshot = ResultContainer()
            for field in ('main_results_map', 'infoboxes', 'suggestions', 'answers',
                          'corrections', 'unresponsive_engines', 'paging', 'redirect_url'):
                setattr(snapshot, field, copy.deepcopy(getattr(self, field)))
            # Never call close/get_ordered_results on the running original container.
            for result in snapshot.main_results_map.values():
                result.score = calculate_score(result, result.priority)
            snapshot._closed = True
            return snapshot


def stream_search_response(search, query, request, image_proxify):
    """A bounded private snapshot feed, converted to XTend AppService frames by Node."""
    updates = queue.Queue(maxsize=1)
    stopped = threading.Event()

    def put(value):
        if stopped.is_set():
            return
        try:
            updates.put_nowait(value)
        except queue.Full:
            try:
                updates.get_nowait()
            except queue.Empty:
                pass
            try:
                updates.put_nowait(value)
            except queue.Full:
                pass

    def serialize(container):
        return json.loads(enrich_response(get_json_response(query, container),
                                         query, container, request, image_proxify))

    def publish(snapshot):
        put({'kind': 'snapshot', 'data': serialize(snapshot)})

    container = SnapshotContainer(publish, stopped)
    container.on_result = search.result_container.on_result
    search.result_container = container

    @copy_current_request_context
    def run():
        try:
            final = search.search()
            if final.redirect_url:
                put({'kind': 'complete', 'redirect': final.redirect_url})
            else:
                put({'kind': 'complete', 'data': serialize(final)})
        except Exception:  # public errors deliberately omit provider details
            put({'kind': 'error', 'message': 'Die Suche konnte nicht abgeschlossen werden.'})

    @stream_with_context
    def generate():
        worker = threading.Thread(target=run, name='xtend-search-stream', daemon=True)
        worker.start()
        try:
            yield '{"kind":"start"}\n'
            while not stopped.is_set():
                try:
                    item = updates.get(timeout=0.25)
                except queue.Empty:
                    # Also gives WSGI a bounded opportunity to observe disconnects.
                    yield '{"kind":"ping"}\n'
                    continue
                yield json.dumps(item, ensure_ascii=False) + '\n'
                if item['kind'] in ('complete', 'error'):
                    return
        finally:
            stopped.set()
            # Existing HTTP engine calls finish within their upstream timeouts.
            # Late results are ignored; Python threads are never killed unsafely.

    return Response(generate(), mimetype='application/x-ndjson',
                    headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

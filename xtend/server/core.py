"""Mount the branded upstream application at root and /classic without rewriting HTML."""
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from searx.webapp import app

application = DispatcherMiddleware(app, {'/classic': app})

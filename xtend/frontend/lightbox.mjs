import './components/x-search-lightbox.mjs';
export function createSearchLightbox(options){
 const box=document.createElement('x-search-lightbox');box.id='search-lightbox';box.className='search-lightbox';box.configureSearch(options);document.body.append(box);
 return {open:(items,id)=>box.openCarousel(items,id),close:options=>box.closeCarousel(options),isOpen:()=>box.isCarouselOpen(),updateEntries:items=>box.updateCarousel(items)};
}

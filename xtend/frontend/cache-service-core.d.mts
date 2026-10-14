export interface CacheScope {version:string;contextKey:string}
export interface SearchCacheMeta {schema:string;enabled:boolean;cacheable:boolean;epoch:string;identity:Record<string,unknown>;url:string;createdAt:number;expiresAt:number;tokenExpiresAt:number;mediaExpiresAt:number;feedbackExpiresAt:number}
export interface SearchCacheData {cache:SearchCacheMeta;stream?:{phase:string};error?:boolean;skeleton?:boolean;empty?:boolean;[key:string]:unknown}
export interface SearchCachedResource {data:SearchCacheData;identity:Record<string,unknown>;epoch:string;requestUrl:string}
export interface CacheContext {signal?:AbortSignal;cacheContextQuery:(signal?:AbortSignal)=>Promise<{schema:string;enabled:boolean;epoch:string}>}
export function captureSearchResource(input:{data:SearchCacheData;scope:CacheScope}):boolean;
export function restoreSearchResource(input:{url:string;scope:CacheScope},context:unknown):Promise<SearchCachedResource|null>;
export function invalidateSearchResource(input?:{url?:string;scope?:CacheScope}):boolean;
export function clearSearchResources():void;
export function weatherTabUrl(url:string,scope:CacheScope):string;
export function searchCacheStats():Readonly<{entries:number;bytes:number;hits:number;misses:number;evictions:number;expired:number}>;

export namespace main {
	
	export class AppSettings {
	    lastOpenedFile: string;
	    autoLoadLastFile: boolean;
	    theme: string;
	    fontSize: number;
	    displayMode: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lastOpenedFile = source["lastOpenedFile"];
	        this.autoLoadLastFile = source["autoLoadLastFile"];
	        this.theme = source["theme"];
	        this.fontSize = source["fontSize"];
	        this.displayMode = source["displayMode"];
	    }
	}
	export class LoadResult {
	    success: boolean;
	    message: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new LoadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.count = source["count"];
	    }
	}
	export class SearchQuery {
	    keyword: string;
	    level: string;
	    class: string;
	    startTime: string;
	    endTime: string;
	    page: number;
	    pageSize: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchQuery(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.keyword = source["keyword"];
	        this.level = source["level"];
	        this.class = source["class"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	    }
	}
	export class SearchResult {
	    entries: store.LogEntry[];
	    total: number;
	    page: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entries = this.convertValues(source["entries"], store.LogEntry);
	        this.total = source["total"];
	        this.page = source["page"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Stats {
	    total: number;
	    trace: number;
	    debug: number;
	    info: number;
	    warn: number;
	    error: number;
	    byClass: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new Stats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.trace = source["trace"];
	        this.debug = source["debug"];
	        this.info = source["info"];
	        this.warn = source["warn"];
	        this.error = source["error"];
	        this.byClass = source["byClass"];
	    }
	}

}

export namespace store {
	
	export class LogEntry {
	    id: number;
	    timestamp: string;
	    level: string;
	    source: string;
	    class: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.level = source["level"];
	        this.source = source["source"];
	        this.class = source["class"];
	        this.message = source["message"];
	    }
	}

}


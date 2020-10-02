
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var papaparse_min = createCommonjsModule(function (module, exports) {
    /* @license
    Papa Parse
    v5.3.0
    https://github.com/mholt/PapaParse
    License: MIT
    */
    !function(e,t){module.exports=t();}(commonjsGlobal,function s(){var f="undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==f?f:{};var n=!f.document&&!!f.postMessage,o=n&&/blob:/i.test((f.location||{}).protocol),a={},h=0,b={parse:function(e,t){var i=(t=t||{}).dynamicTyping||!1;U(i)&&(t.dynamicTypingFunction=i,i={});if(t.dynamicTyping=i,t.transform=!!U(t.transform)&&t.transform,t.worker&&b.WORKERS_SUPPORTED){var r=function(){if(!b.WORKERS_SUPPORTED)return !1;var e=(i=f.URL||f.webkitURL||null,r=s.toString(),b.BLOB_URL||(b.BLOB_URL=i.createObjectURL(new Blob(["(",r,")();"],{type:"text/javascript"})))),t=new f.Worker(e);var i,r;return t.onmessage=m,t.id=h++,a[t.id]=t}();return r.userStep=t.step,r.userChunk=t.chunk,r.userComplete=t.complete,r.userError=t.error,t.step=U(t.step),t.chunk=U(t.chunk),t.complete=U(t.complete),t.error=U(t.error),delete t.worker,void r.postMessage({input:e,config:t,workerId:r.id})}var n=null;"string"==typeof e?n=t.download?new l(t):new p(t):!0===e.readable&&U(e.read)&&U(e.on)?n=new g(t):(f.File&&e instanceof File||e instanceof Object)&&(n=new c(t));return n.stream(e)},unparse:function(e,t){var n=!1,m=!0,_=",",v="\r\n",s='"',a=s+s,i=!1,r=null,o=!1;!function(){if("object"!=typeof t)return;"string"!=typeof t.delimiter||b.BAD_DELIMITERS.filter(function(e){return -1!==t.delimiter.indexOf(e)}).length||(_=t.delimiter);("boolean"==typeof t.quotes||"function"==typeof t.quotes||Array.isArray(t.quotes))&&(n=t.quotes);"boolean"!=typeof t.skipEmptyLines&&"string"!=typeof t.skipEmptyLines||(i=t.skipEmptyLines);"string"==typeof t.newline&&(v=t.newline);"string"==typeof t.quoteChar&&(s=t.quoteChar);"boolean"==typeof t.header&&(m=t.header);if(Array.isArray(t.columns)){if(0===t.columns.length)throw new Error("Option columns is empty");r=t.columns;}void 0!==t.escapeChar&&(a=t.escapeChar+s);"boolean"==typeof t.escapeFormulae&&(o=t.escapeFormulae);}();var h=new RegExp(q(s),"g");"string"==typeof e&&(e=JSON.parse(e));if(Array.isArray(e)){if(!e.length||Array.isArray(e[0]))return f(null,e,i);if("object"==typeof e[0])return f(r||u(e[0]),e,i)}else if("object"==typeof e)return "string"==typeof e.data&&(e.data=JSON.parse(e.data)),Array.isArray(e.data)&&(e.fields||(e.fields=e.meta&&e.meta.fields),e.fields||(e.fields=Array.isArray(e.data[0])?e.fields:u(e.data[0])),Array.isArray(e.data[0])||"object"==typeof e.data[0]||(e.data=[e.data])),f(e.fields||[],e.data||[],i);throw new Error("Unable to serialize unrecognized input");function u(e){if("object"!=typeof e)return [];var t=[];for(var i in e)t.push(i);return t}function f(e,t,i){var r="";"string"==typeof e&&(e=JSON.parse(e)),"string"==typeof t&&(t=JSON.parse(t));var n=Array.isArray(e)&&0<e.length,s=!Array.isArray(t[0]);if(n&&m){for(var a=0;a<e.length;a++)0<a&&(r+=_),r+=y(e[a],a);0<t.length&&(r+=v);}for(var o=0;o<t.length;o++){var h=n?e.length:t[o].length,u=!1,f=n?0===Object.keys(t[o]).length:0===t[o].length;if(i&&!n&&(u="greedy"===i?""===t[o].join("").trim():1===t[o].length&&0===t[o][0].length),"greedy"===i&&n){for(var d=[],l=0;l<h;l++){var c=s?e[l]:l;d.push(t[o][c]);}u=""===d.join("").trim();}if(!u){for(var p=0;p<h;p++){0<p&&!f&&(r+=_);var g=n&&s?e[p]:p;r+=y(t[o][g],p);}o<t.length-1&&(!i||0<h&&!f)&&(r+=v);}}return r}function y(e,t){if(null==e)return "";if(e.constructor===Date)return JSON.stringify(e).slice(1,25);!0===o&&"string"==typeof e&&null!==e.match(/^[=+\-@].*$/)&&(e="'"+e);var i=e.toString().replace(h,a),r="boolean"==typeof n&&n||"function"==typeof n&&n(e,t)||Array.isArray(n)&&n[t]||function(e,t){for(var i=0;i<t.length;i++)if(-1<e.indexOf(t[i]))return !0;return !1}(i,b.BAD_DELIMITERS)||-1<i.indexOf(_)||" "===i.charAt(0)||" "===i.charAt(i.length-1);return r?s+i+s:i}}};if(b.RECORD_SEP=String.fromCharCode(30),b.UNIT_SEP=String.fromCharCode(31),b.BYTE_ORDER_MARK="\ufeff",b.BAD_DELIMITERS=["\r","\n",'"',b.BYTE_ORDER_MARK],b.WORKERS_SUPPORTED=!n&&!!f.Worker,b.NODE_STREAM_INPUT=1,b.LocalChunkSize=10485760,b.RemoteChunkSize=5242880,b.DefaultDelimiter=",",b.Parser=w,b.ParserHandle=i,b.NetworkStreamer=l,b.FileStreamer=c,b.StringStreamer=p,b.ReadableStreamStreamer=g,f.jQuery){var d=f.jQuery;d.fn.parse=function(o){var i=o.config||{},h=[];return this.each(function(e){if(!("INPUT"===d(this).prop("tagName").toUpperCase()&&"file"===d(this).attr("type").toLowerCase()&&f.FileReader)||!this.files||0===this.files.length)return !0;for(var t=0;t<this.files.length;t++)h.push({file:this.files[t],inputElem:this,instanceConfig:d.extend({},i)});}),e(),this;function e(){if(0!==h.length){var e,t,i,r,n=h[0];if(U(o.before)){var s=o.before(n.file,n.inputElem);if("object"==typeof s){if("abort"===s.action)return e="AbortError",t=n.file,i=n.inputElem,r=s.reason,void(U(o.error)&&o.error({name:e},t,i,r));if("skip"===s.action)return void u();"object"==typeof s.config&&(n.instanceConfig=d.extend(n.instanceConfig,s.config));}else if("skip"===s)return void u()}var a=n.instanceConfig.complete;n.instanceConfig.complete=function(e){U(a)&&a(e,n.file,n.inputElem),u();},b.parse(n.file,n.instanceConfig);}else U(o.complete)&&o.complete();}function u(){h.splice(0,1),e();}};}function u(e){this._handle=null,this._finished=!1,this._completed=!1,this._halted=!1,this._input=null,this._baseIndex=0,this._partialLine="",this._rowCount=0,this._start=0,this._nextChunk=null,this.isFirstChunk=!0,this._completeResults={data:[],errors:[],meta:{}},function(e){var t=E(e);t.chunkSize=parseInt(t.chunkSize),e.step||e.chunk||(t.chunkSize=null);this._handle=new i(t),(this._handle.streamer=this)._config=t;}.call(this,e),this.parseChunk=function(e,t){if(this.isFirstChunk&&U(this._config.beforeFirstChunk)){var i=this._config.beforeFirstChunk(e);void 0!==i&&(e=i);}this.isFirstChunk=!1,this._halted=!1;var r=this._partialLine+e;this._partialLine="";var n=this._handle.parse(r,this._baseIndex,!this._finished);if(!this._handle.paused()&&!this._handle.aborted()){var s=n.meta.cursor;this._finished||(this._partialLine=r.substring(s-this._baseIndex),this._baseIndex=s),n&&n.data&&(this._rowCount+=n.data.length);var a=this._finished||this._config.preview&&this._rowCount>=this._config.preview;if(o)f.postMessage({results:n,workerId:b.WORKER_ID,finished:a});else if(U(this._config.chunk)&&!t){if(this._config.chunk(n,this._handle),this._handle.paused()||this._handle.aborted())return void(this._halted=!0);n=void 0,this._completeResults=void 0;}return this._config.step||this._config.chunk||(this._completeResults.data=this._completeResults.data.concat(n.data),this._completeResults.errors=this._completeResults.errors.concat(n.errors),this._completeResults.meta=n.meta),this._completed||!a||!U(this._config.complete)||n&&n.meta.aborted||(this._config.complete(this._completeResults,this._input),this._completed=!0),a||n&&n.meta.paused||this._nextChunk(),n}this._halted=!0;},this._sendError=function(e){U(this._config.error)?this._config.error(e):o&&this._config.error&&f.postMessage({workerId:b.WORKER_ID,error:e,finished:!1});};}function l(e){var r;(e=e||{}).chunkSize||(e.chunkSize=b.RemoteChunkSize),u.call(this,e),this._nextChunk=n?function(){this._readChunk(),this._chunkLoaded();}:function(){this._readChunk();},this.stream=function(e){this._input=e,this._nextChunk();},this._readChunk=function(){if(this._finished)this._chunkLoaded();else {if(r=new XMLHttpRequest,this._config.withCredentials&&(r.withCredentials=this._config.withCredentials),n||(r.onload=y(this._chunkLoaded,this),r.onerror=y(this._chunkError,this)),r.open(this._config.downloadRequestBody?"POST":"GET",this._input,!n),this._config.downloadRequestHeaders){var e=this._config.downloadRequestHeaders;for(var t in e)r.setRequestHeader(t,e[t]);}if(this._config.chunkSize){var i=this._start+this._config.chunkSize-1;r.setRequestHeader("Range","bytes="+this._start+"-"+i);}try{r.send(this._config.downloadRequestBody);}catch(e){this._chunkError(e.message);}n&&0===r.status&&this._chunkError();}},this._chunkLoaded=function(){4===r.readyState&&(r.status<200||400<=r.status?this._chunkError():(this._start+=this._config.chunkSize?this._config.chunkSize:r.responseText.length,this._finished=!this._config.chunkSize||this._start>=function(e){var t=e.getResponseHeader("Content-Range");if(null===t)return -1;return parseInt(t.substring(t.lastIndexOf("/")+1))}(r),this.parseChunk(r.responseText)));},this._chunkError=function(e){var t=r.statusText||e;this._sendError(new Error(t));};}function c(e){var r,n;(e=e||{}).chunkSize||(e.chunkSize=b.LocalChunkSize),u.call(this,e);var s="undefined"!=typeof FileReader;this.stream=function(e){this._input=e,n=e.slice||e.webkitSlice||e.mozSlice,s?((r=new FileReader).onload=y(this._chunkLoaded,this),r.onerror=y(this._chunkError,this)):r=new FileReaderSync,this._nextChunk();},this._nextChunk=function(){this._finished||this._config.preview&&!(this._rowCount<this._config.preview)||this._readChunk();},this._readChunk=function(){var e=this._input;if(this._config.chunkSize){var t=Math.min(this._start+this._config.chunkSize,this._input.size);e=n.call(e,this._start,t);}var i=r.readAsText(e,this._config.encoding);s||this._chunkLoaded({target:{result:i}});},this._chunkLoaded=function(e){this._start+=this._config.chunkSize,this._finished=!this._config.chunkSize||this._start>=this._input.size,this.parseChunk(e.target.result);},this._chunkError=function(){this._sendError(r.error);};}function p(e){var i;u.call(this,e=e||{}),this.stream=function(e){return i=e,this._nextChunk()},this._nextChunk=function(){if(!this._finished){var e,t=this._config.chunkSize;return t?(e=i.substring(0,t),i=i.substring(t)):(e=i,i=""),this._finished=!i,this.parseChunk(e)}};}function g(e){u.call(this,e=e||{});var t=[],i=!0,r=!1;this.pause=function(){u.prototype.pause.apply(this,arguments),this._input.pause();},this.resume=function(){u.prototype.resume.apply(this,arguments),this._input.resume();},this.stream=function(e){this._input=e,this._input.on("data",this._streamData),this._input.on("end",this._streamEnd),this._input.on("error",this._streamError);},this._checkIsFinished=function(){r&&1===t.length&&(this._finished=!0);},this._nextChunk=function(){this._checkIsFinished(),t.length?this.parseChunk(t.shift()):i=!0;},this._streamData=y(function(e){try{t.push("string"==typeof e?e:e.toString(this._config.encoding)),i&&(i=!1,this._checkIsFinished(),this.parseChunk(t.shift()));}catch(e){this._streamError(e);}},this),this._streamError=y(function(e){this._streamCleanUp(),this._sendError(e);},this),this._streamEnd=y(function(){this._streamCleanUp(),r=!0,this._streamData("");},this),this._streamCleanUp=y(function(){this._input.removeListener("data",this._streamData),this._input.removeListener("end",this._streamEnd),this._input.removeListener("error",this._streamError);},this);}function i(_){var a,o,h,r=Math.pow(2,53),n=-r,s=/^\s*-?(\d+\.?|\.\d+|\d+\.\d+)(e[-+]?\d+)?\s*$/,u=/(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,t=this,i=0,f=0,d=!1,e=!1,l=[],c={data:[],errors:[],meta:{}};if(U(_.step)){var p=_.step;_.step=function(e){if(c=e,m())g();else {if(g(),0===c.data.length)return;i+=e.data.length,_.preview&&i>_.preview?o.abort():(c.data=c.data[0],p(c,t));}};}function v(e){return "greedy"===_.skipEmptyLines?""===e.join("").trim():1===e.length&&0===e[0].length}function g(){if(c&&h&&(k("Delimiter","UndetectableDelimiter","Unable to auto-detect delimiting character; defaulted to '"+b.DefaultDelimiter+"'"),h=!1),_.skipEmptyLines)for(var e=0;e<c.data.length;e++)v(c.data[e])&&c.data.splice(e--,1);return m()&&function(){if(!c)return;function e(e,t){U(_.transformHeader)&&(e=_.transformHeader(e,t)),l.push(e);}if(Array.isArray(c.data[0])){for(var t=0;m()&&t<c.data.length;t++)c.data[t].forEach(e);c.data.splice(0,1);}else c.data.forEach(e);}(),function(){if(!c||!_.header&&!_.dynamicTyping&&!_.transform)return c;function e(e,t){var i,r=_.header?{}:[];for(i=0;i<e.length;i++){var n=i,s=e[i];_.header&&(n=i>=l.length?"__parsed_extra":l[i]),_.transform&&(s=_.transform(s,n)),s=y(n,s),"__parsed_extra"===n?(r[n]=r[n]||[],r[n].push(s)):r[n]=s;}return _.header&&(i>l.length?k("FieldMismatch","TooManyFields","Too many fields: expected "+l.length+" fields but parsed "+i,f+t):i<l.length&&k("FieldMismatch","TooFewFields","Too few fields: expected "+l.length+" fields but parsed "+i,f+t)),r}var t=1;!c.data.length||Array.isArray(c.data[0])?(c.data=c.data.map(e),t=c.data.length):c.data=e(c.data,0);_.header&&c.meta&&(c.meta.fields=l);return f+=t,c}()}function m(){return _.header&&0===l.length}function y(e,t){return i=e,_.dynamicTypingFunction&&void 0===_.dynamicTyping[i]&&(_.dynamicTyping[i]=_.dynamicTypingFunction(i)),!0===(_.dynamicTyping[i]||_.dynamicTyping)?"true"===t||"TRUE"===t||"false"!==t&&"FALSE"!==t&&(function(e){if(s.test(e)){var t=parseFloat(e);if(n<t&&t<r)return !0}return !1}(t)?parseFloat(t):u.test(t)?new Date(t):""===t?null:t):t;var i;}function k(e,t,i,r){var n={type:e,code:t,message:i};void 0!==r&&(n.row=r),c.errors.push(n);}this.parse=function(e,t,i){var r=_.quoteChar||'"';if(_.newline||(_.newline=function(e,t){e=e.substring(0,1048576);var i=new RegExp(q(t)+"([^]*?)"+q(t),"gm"),r=(e=e.replace(i,"")).split("\r"),n=e.split("\n"),s=1<n.length&&n[0].length<r[0].length;if(1===r.length||s)return "\n";for(var a=0,o=0;o<r.length;o++)"\n"===r[o][0]&&a++;return a>=r.length/2?"\r\n":"\r"}(e,r)),h=!1,_.delimiter)U(_.delimiter)&&(_.delimiter=_.delimiter(e),c.meta.delimiter=_.delimiter);else {var n=function(e,t,i,r,n){var s,a,o,h;n=n||[",","\t","|",";",b.RECORD_SEP,b.UNIT_SEP];for(var u=0;u<n.length;u++){var f=n[u],d=0,l=0,c=0;o=void 0;for(var p=new w({comments:r,delimiter:f,newline:t,preview:10}).parse(e),g=0;g<p.data.length;g++)if(i&&v(p.data[g]))c++;else {var m=p.data[g].length;l+=m,void 0!==o?0<m&&(d+=Math.abs(m-o),o=m):o=m;}0<p.data.length&&(l/=p.data.length-c),(void 0===a||d<=a)&&(void 0===h||h<l)&&1.99<l&&(a=d,s=f,h=l);}return {successful:!!(_.delimiter=s),bestDelimiter:s}}(e,_.newline,_.skipEmptyLines,_.comments,_.delimitersToGuess);n.successful?_.delimiter=n.bestDelimiter:(h=!0,_.delimiter=b.DefaultDelimiter),c.meta.delimiter=_.delimiter;}var s=E(_);return _.preview&&_.header&&s.preview++,a=e,o=new w(s),c=o.parse(a,t,i),g(),d?{meta:{paused:!0}}:c||{meta:{paused:!1}}},this.paused=function(){return d},this.pause=function(){d=!0,o.abort(),a=U(_.chunk)?"":a.substring(o.getCharIndex());},this.resume=function(){t.streamer._halted?(d=!1,t.streamer.parseChunk(a,!0)):setTimeout(t.resume,3);},this.aborted=function(){return e},this.abort=function(){e=!0,o.abort(),c.meta.aborted=!0,U(_.complete)&&_.complete(c),a="";};}function q(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(e){var O,D=(e=e||{}).delimiter,I=e.newline,T=e.comments,A=e.step,L=e.preview,F=e.fastMode,z=O=void 0===e.quoteChar?'"':e.quoteChar;if(void 0!==e.escapeChar&&(z=e.escapeChar),("string"!=typeof D||-1<b.BAD_DELIMITERS.indexOf(D))&&(D=","),T===D)throw new Error("Comment character same as delimiter");!0===T?T="#":("string"!=typeof T||-1<b.BAD_DELIMITERS.indexOf(T))&&(T=!1),"\n"!==I&&"\r"!==I&&"\r\n"!==I&&(I="\n");var M=0,j=!1;this.parse=function(a,t,i){if("string"!=typeof a)throw new Error("Input must be a string");var r=a.length,e=D.length,n=I.length,s=T.length,o=U(A),h=[],u=[],f=[],d=M=0;if(!a)return R();if(F||!1!==F&&-1===a.indexOf(O)){for(var l=a.split(I),c=0;c<l.length;c++){if(f=l[c],M+=f.length,c!==l.length-1)M+=I.length;else if(i)return R();if(!T||f.substring(0,s)!==T){if(o){if(h=[],b(f.split(D)),S(),j)return R()}else b(f.split(D));if(L&&L<=c)return h=h.slice(0,L),R(!0)}}return R()}for(var p=a.indexOf(D,M),g=a.indexOf(I,M),m=new RegExp(q(z)+q(O),"g"),_=a.indexOf(O,M);;)if(a[M]!==O)if(T&&0===f.length&&a.substring(M,M+s)===T){if(-1===g)return R();M=g+n,g=a.indexOf(I,M),p=a.indexOf(D,M);}else {if(-1!==p&&(p<g||-1===g)){if(!(p<_)){f.push(a.substring(M,p)),M=p+e,p=a.indexOf(D,M);continue}var v=x(p,_,g);if(v&&void 0!==v.nextDelim){p=v.nextDelim,_=v.quoteSearch,f.push(a.substring(M,p)),M=p+e,p=a.indexOf(D,M);continue}}if(-1===g)break;if(f.push(a.substring(M,g)),C(g+n),o&&(S(),j))return R();if(L&&h.length>=L)return R(!0)}else for(_=M,M++;;){if(-1===(_=a.indexOf(O,_+1)))return i||u.push({type:"Quotes",code:"MissingQuotes",message:"Quoted field unterminated",row:h.length,index:M}),E();if(_===r-1)return E(a.substring(M,_).replace(m,O));if(O!==z||a[_+1]!==z){if(O===z||0===_||a[_-1]!==z){-1!==p&&p<_+1&&(p=a.indexOf(D,_+1)),-1!==g&&g<_+1&&(g=a.indexOf(I,_+1));var y=w(-1===g?p:Math.min(p,g));if(a[_+1+y]===D){f.push(a.substring(M,_).replace(m,O)),a[M=_+1+y+e]!==O&&(_=a.indexOf(O,M)),p=a.indexOf(D,M),g=a.indexOf(I,M);break}var k=w(g);if(a.substring(_+1+k,_+1+k+n)===I){if(f.push(a.substring(M,_).replace(m,O)),C(_+1+k+n),p=a.indexOf(D,M),_=a.indexOf(O,M),o&&(S(),j))return R();if(L&&h.length>=L)return R(!0);break}u.push({type:"Quotes",code:"InvalidQuotes",message:"Trailing quote on quoted field is malformed",row:h.length,index:M}),_++;}}else _++;}return E();function b(e){h.push(e),d=M;}function w(e){var t=0;if(-1!==e){var i=a.substring(_+1,e);i&&""===i.trim()&&(t=i.length);}return t}function E(e){return i||(void 0===e&&(e=a.substring(M)),f.push(e),M=r,b(f),o&&S()),R()}function C(e){M=e,b(f),f=[],g=a.indexOf(I,M);}function R(e){return {data:h,errors:u,meta:{delimiter:D,linebreak:I,aborted:j,truncated:!!e,cursor:d+(t||0)}}}function S(){A(R()),h=[],u=[];}function x(e,t,i){var r={nextDelim:void 0,quoteSearch:void 0},n=a.indexOf(O,t+1);if(t<e&&e<n&&(n<i||-1===i)){var s=a.indexOf(D,n);if(-1===s)return r;n<s&&(n=a.indexOf(O,n+1)),r=x(s,n,i);}else r={nextDelim:e,quoteSearch:t};return r}},this.abort=function(){j=!0;},this.getCharIndex=function(){return M};}function m(e){var t=e.data,i=a[t.workerId],r=!1;if(t.error)i.userError(t.error,t.file);else if(t.results&&t.results.data){var n={abort:function(){r=!0,_(t.workerId,{data:[],errors:[],meta:{aborted:!0}});},pause:v,resume:v};if(U(i.userStep)){for(var s=0;s<t.results.data.length&&(i.userStep({data:t.results.data[s],errors:t.results.errors,meta:t.results.meta},n),!r);s++);delete t.results;}else U(i.userChunk)&&(i.userChunk(t.results,n,t.file),delete t.results);}t.finished&&!r&&_(t.workerId,t.results);}function _(e,t){var i=a[e];U(i.userComplete)&&i.userComplete(t),i.terminate(),delete a[e];}function v(){throw new Error("Not implemented.")}function E(e){if("object"!=typeof e||null===e)return e;var t=Array.isArray(e)?[]:{};for(var i in e)t[i]=E(e[i]);return t}function y(e,t){return function(){e.apply(t,arguments);}}function U(e){return "function"==typeof e}return o&&(f.onmessage=function(e){var t=e.data;void 0===b.WORKER_ID&&t&&(b.WORKER_ID=t.workerId);if("string"==typeof t.input)f.postMessage({workerId:b.WORKER_ID,results:b.parse(t.input,t.config),finished:!0});else if(f.File&&t.input instanceof File||t.input instanceof Object){var i=b.parse(t.input,t.config);i&&f.postMessage({workerId:b.WORKER_ID,results:i,finished:!0});}}),(l.prototype=Object.create(u.prototype)).constructor=l,(c.prototype=Object.create(u.prototype)).constructor=c,(p.prototype=Object.create(p.prototype)).constructor=p,(g.prototype=Object.create(u.prototype)).constructor=g,b});
    });

    /* src\ChooseColumns.svelte generated by Svelte v3.29.0 */
    const file = "src\\ChooseColumns.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[7] = list;
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (27:0) {#if columns.length > 0}
    function create_if_block(ctx) {
    	let table;
    	let tr0;
    	let t0;
    	let tr1;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value_2 = /*columns*/ ctx[0];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*columns*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			tr0 = element("tr");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t0 = space();
    			tr1 = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			button = element("button");
    			button.textContent = "Geocode";
    			add_location(tr0, file, 28, 4, 625);
    			add_location(tr1, file, 33, 4, 728);
    			add_location(table, file, 27, 2, 612);
    			add_location(button, file, 46, 2, 1105);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, tr0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(tr0, null);
    			}

    			append_dev(table, t0);
    			append_dev(table, tr1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr1, null);
    			}

    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*geocodeButtonClickHandler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*columns*/ 1) {
    				each_value_2 = /*columns*/ ctx[0];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(tr0, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*columnSelects, geocodingAttributes, columns*/ 7) {
    				each_value = /*columns*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tr1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(27:0) {#if columns.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (30:6) {#each columns as column, index}
    function create_each_block_2(ctx) {
    	let td;
    	let t_value = /*column*/ ctx[6] + "";
    	let t;

    	const block = {
    		c: function create() {
    			td = element("td");
    			t = text(t_value);
    			add_location(td, file, 30, 8, 679);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*columns*/ 1 && t_value !== (t_value = /*column*/ ctx[6] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(30:6) {#each columns as column, index}",
    		ctx
    	});

    	return block;
    }

    // (39:12) {#each geocodingAttributes as geocodingAttribute}
    function create_each_block_1(ctx) {
    	let option;
    	let t_value = /*geocodingAttribute*/ ctx[9] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*geocodingAttribute*/ ctx[9];
    			option.value = option.__value;
    			add_location(option, file, 39, 14, 942);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(39:12) {#each geocodingAttributes as geocodingAttribute}",
    		ctx
    	});

    	return block;
    }

    // (35:6) {#each columns as column, index}
    function create_each_block(ctx) {
    	let td;
    	let select;
    	let option;
    	let index = /*index*/ ctx[8];
    	let t;
    	let each_value_1 = /*geocodingAttributes*/ ctx[2];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const assign_select = () => /*select_binding*/ ctx[4](select, index);
    	const unassign_select = () => /*select_binding*/ ctx[4](null, index);

    	const block = {
    		c: function create() {
    			td = element("td");
    			select = element("select");
    			option = element("option");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			option.__value = "";
    			option.value = option.__value;
    			add_location(option, file, 37, 12, 853);
    			add_location(select, file, 36, 10, 798);
    			add_location(td, file, 35, 8, 782);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, select);
    			append_dev(select, option);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			assign_select();
    			append_dev(td, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*geocodingAttributes*/ 4) {
    				each_value_1 = /*geocodingAttributes*/ ctx[2];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (index !== /*index*/ ctx[8]) {
    				unassign_select();
    				index = /*index*/ ctx[8];
    				assign_select();
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    			destroy_each(each_blocks, detaching);
    			unassign_select();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(35:6) {#each columns as column, index}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let if_block_anchor;
    	let if_block = /*columns*/ ctx[0].length > 0 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*columns*/ ctx[0].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ChooseColumns", slots, []);
    	let { columns } = $$props;
    	let columnSelects = [];
    	const dispatch = createEventDispatcher();
    	const geocodingAttributes = ["SingleLine", "Address", "City", "Region", "Postal", "countryCode"];

    	const geocodeButtonClickHandler = () => {
    		const geocodingInfo = columns.map((column, i) => {
    			return {
    				column,
    				geocodingAttribute: columnSelects[i].value
    			};
    		});

    		dispatch("geocode", geocodingInfo);
    	};

    	const writable_props = ["columns"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ChooseColumns> was created with unknown prop '${key}'`);
    	});

    	function select_binding($$value, index) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			columnSelects[index] = $$value;
    			$$invalidate(1, columnSelects);
    			$$invalidate(2, geocodingAttributes);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("columns" in $$props) $$invalidate(0, columns = $$props.columns);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		columns,
    		columnSelects,
    		dispatch,
    		geocodingAttributes,
    		geocodeButtonClickHandler
    	});

    	$$self.$inject_state = $$props => {
    		if ("columns" in $$props) $$invalidate(0, columns = $$props.columns);
    		if ("columnSelects" in $$props) $$invalidate(1, columnSelects = $$props.columnSelects);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		columns,
    		columnSelects,
    		geocodingAttributes,
    		geocodeButtonClickHandler,
    		select_binding
    	];
    }

    class ChooseColumns extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { columns: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ChooseColumns",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*columns*/ ctx[0] === undefined && !("columns" in props)) {
    			console.warn("<ChooseColumns> was created without expected prop 'columns'");
    		}
    	}

    	get columns() {
    		throw new Error("<ChooseColumns>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set columns(value) {
    		throw new Error("<ChooseColumns>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$1 = function() {
        __assign$1 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$1.apply(this, arguments);
    };

    /* Copyright (c) 2017 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    /**
     * Checks parameters to see if we should use FormData to send the request
     * @param params The object whose keys will be encoded.
     * @return A boolean indicating if FormData will be required.
     */
    function requiresFormData(params) {
        return Object.keys(params).some(function (key) {
            var value = params[key];
            if (!value) {
                return false;
            }
            if (value && value.toParam) {
                value = value.toParam();
            }
            var type = value.constructor.name;
            switch (type) {
                case "Array":
                    return false;
                case "Object":
                    return false;
                case "Date":
                    return false;
                case "Function":
                    return false;
                case "Boolean":
                    return false;
                case "String":
                    return false;
                case "Number":
                    return false;
                default:
                    return true;
            }
        });
    }
    /**
     * Converts parameters to the proper representation to send to the ArcGIS REST API.
     * @param params The object whose keys will be encoded.
     * @return A new object with properly encoded values.
     */
    function processParams(params) {
        var newParams = {};
        Object.keys(params).forEach(function (key) {
            var param = params[key];
            if (param && param.toParam) {
                param = param.toParam();
            }
            if (!param &&
                param !== 0 &&
                typeof param !== "boolean" &&
                typeof param !== "string") {
                return;
            }
            var type = param.constructor.name;
            var value;
            // properly encodes objects, arrays and dates for arcgis.com and other services.
            // ported from https://github.com/Esri/esri-leaflet/blob/master/src/Request.js#L22-L30
            // also see https://github.com/Esri/arcgis-rest-js/issues/18:
            // null, undefined, function are excluded. If you want to send an empty key you need to send an empty string "".
            switch (type) {
                case "Array":
                    // Based on the first element of the array, classify array as an array of objects to be stringified
                    // or an array of non-objects to be comma-separated
                    value =
                        param[0] &&
                            param[0].constructor &&
                            param[0].constructor.name === "Object"
                            ? JSON.stringify(param)
                            : param.join(",");
                    break;
                case "Object":
                    value = JSON.stringify(param);
                    break;
                case "Date":
                    value = param.valueOf();
                    break;
                case "Function":
                    value = null;
                    break;
                case "Boolean":
                    value = param + "";
                    break;
                default:
                    value = param;
                    break;
            }
            if (value || value === 0 || typeof value === "string") {
                newParams[key] = value;
            }
        });
        return newParams;
    }

    /* Copyright (c) 2017 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    function encodeParam(key, value) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(value);
    }
    /**
     * Encodes the passed object as a query string.
     *
     * @param params An object to be encoded.
     * @returns An encoded query string.
     */
    function encodeQueryString(params) {
        var newParams = processParams(params);
        return Object.keys(newParams)
            .map(function (key) {
            return encodeParam(key, newParams[key]);
        })
            .join("&");
    }

    /* Copyright (c) 2017 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    /**
     * Encodes parameters in a [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) object in browsers or in a [FormData](https://github.com/form-data/form-data) in Node.js
     *
     * @param params An object to be encoded.
     * @returns The complete [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) object.
     */
    function encodeFormData(params, forceFormData) {
        // see https://github.com/Esri/arcgis-rest-js/issues/499 for more info.
        var useFormData = requiresFormData(params) || forceFormData;
        var newParams = processParams(params);
        if (useFormData) {
            var formData_1 = new FormData();
            Object.keys(newParams).forEach(function (key) {
                if (typeof Blob !== "undefined" && newParams[key] instanceof Blob) {
                    /* To name the Blob:
                     1. look to an alternate request parameter called 'fileName'
                     2. see if 'name' has been tacked onto the Blob manually
                     3. if all else fails, use the request parameter
                    */
                    var filename = newParams["fileName"] || newParams[key].name || key;
                    formData_1.append(key, newParams[key], filename);
                }
                else {
                    formData_1.append(key, newParams[key]);
                }
            });
            return formData_1;
        }
        else {
            return encodeQueryString(params);
        }
    }

    /* Copyright (c) 2017 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    // TypeScript 2.1 no longer allows you to extend built in types. See https://github.com/Microsoft/TypeScript/issues/12790#issuecomment-265981442
    // and https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    //
    // This code is from MDN https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Custom_Error_Types.
    var ArcGISRequestError = /** @class */ (function () {
        /**
         * Create a new `ArcGISRequestError`  object.
         *
         * @param message - The error message from the API
         * @param code - The error code from the API
         * @param response - The original response from the API that caused the error
         * @param url - The original url of the request
         * @param options - The original options and parameters of the request
         */
        function ArcGISRequestError(message, code, response, url, options) {
            message = message || "UNKNOWN_ERROR";
            code = code || "UNKNOWN_ERROR_CODE";
            this.name = "ArcGISRequestError";
            this.message =
                code === "UNKNOWN_ERROR_CODE" ? message : code + ": " + message;
            this.originalMessage = message;
            this.code = code;
            this.response = response;
            this.url = url;
            this.options = options;
        }
        return ArcGISRequestError;
    }());
    ArcGISRequestError.prototype = Object.create(Error.prototype);
    ArcGISRequestError.prototype.constructor = ArcGISRequestError;

    /* Copyright (c) 2017-2018 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    var NODEJS_DEFAULT_REFERER_HEADER = "@esri/arcgis-rest-js";
    var DEFAULT_ARCGIS_REQUEST_OPTIONS = {
        httpMethod: "POST",
        params: {
            f: "json"
        }
    };
    var ArcGISAuthError = /** @class */ (function (_super) {
        __extends(ArcGISAuthError, _super);
        /**
         * Create a new `ArcGISAuthError`  object.
         *
         * @param message - The error message from the API
         * @param code - The error code from the API
         * @param response - The original response from the API that caused the error
         * @param url - The original url of the request
         * @param options - The original options of the request
         */
        function ArcGISAuthError(message, code, response, url, options) {
            if (message === void 0) { message = "AUTHENTICATION_ERROR"; }
            if (code === void 0) { code = "AUTHENTICATION_ERROR_CODE"; }
            var _this = _super.call(this, message, code, response, url, options) || this;
            _this.name = "ArcGISAuthError";
            _this.message =
                code === "AUTHENTICATION_ERROR_CODE" ? message : code + ": " + message;
            return _this;
        }
        ArcGISAuthError.prototype.retry = function (getSession, retryLimit) {
            var _this = this;
            if (retryLimit === void 0) { retryLimit = 3; }
            var tries = 0;
            var retryRequest = function (resolve, reject) {
                getSession(_this.url, _this.options)
                    .then(function (session) {
                    var newOptions = __assign$1(__assign$1({}, _this.options), { authentication: session });
                    tries = tries + 1;
                    return request(_this.url, newOptions);
                })
                    .then(function (response) {
                    resolve(response);
                })
                    .catch(function (e) {
                    if (e.name === "ArcGISAuthError" && tries < retryLimit) {
                        retryRequest(resolve, reject);
                    }
                    else if (e.name === "ArcGISAuthError" && tries >= retryLimit) {
                        reject(_this);
                    }
                    else {
                        reject(e);
                    }
                });
            };
            return new Promise(function (resolve, reject) {
                retryRequest(resolve, reject);
            });
        };
        return ArcGISAuthError;
    }(ArcGISRequestError));
    /**
     * Checks for errors in a JSON response from the ArcGIS REST API. If there are no errors, it will return the `data` passed in. If there is an error, it will throw an `ArcGISRequestError` or `ArcGISAuthError`.
     *
     * @param data The response JSON to check for errors.
     * @param url The url of the original request
     * @param params The parameters of the original request
     * @param options The options of the original request
     * @returns The data that was passed in the `data` parameter
     */
    function checkForErrors(response, url, params, options, originalAuthError) {
        // this is an error message from billing.arcgis.com backend
        if (response.code >= 400) {
            var message = response.message, code = response.code;
            throw new ArcGISRequestError(message, code, response, url, options);
        }
        // error from ArcGIS Online or an ArcGIS Portal or server instance.
        if (response.error) {
            var _a = response.error, message = _a.message, code = _a.code, messageCode = _a.messageCode;
            var errorCode = messageCode || code || "UNKNOWN_ERROR_CODE";
            if (code === 498 ||
                code === 499 ||
                messageCode === "GWM_0003" ||
                (code === 400 && message === "Unable to generate token.")) {
                if (originalAuthError) {
                    throw originalAuthError;
                }
                else {
                    throw new ArcGISAuthError(message, errorCode, response, url, options);
                }
            }
            throw new ArcGISRequestError(message, errorCode, response, url, options);
        }
        // error from a status check
        if (response.status === "failed" || response.status === "failure") {
            var message = void 0;
            var code = "UNKNOWN_ERROR_CODE";
            try {
                message = JSON.parse(response.statusMessage).message;
                code = JSON.parse(response.statusMessage).code;
            }
            catch (e) {
                message = response.statusMessage || response.message;
            }
            throw new ArcGISRequestError(message, code, response, url, options);
        }
        return response;
    }
    /**
     * ```js
     * import { request } from '@esri/arcgis-rest-request';
     * //
     * request('https://www.arcgis.com/sharing/rest')
     *   .then(response) // response.currentVersion === 5.2
     * //
     * request('https://www.arcgis.com/sharing/rest', {
     *   httpMethod: "GET"
     * })
     * //
     * request('https://www.arcgis.com/sharing/rest/search', {
     *   params: { q: 'parks' }
     * })
     *   .then(response) // response.total => 78379
     * ```
     * Generic method for making HTTP requests to ArcGIS REST API endpoints.
     *
     * @param url - The URL of the ArcGIS REST API endpoint.
     * @param requestOptions - Options for the request, including parameters relevant to the endpoint.
     * @returns A Promise that will resolve with the data from the response.
     */
    function request(url, requestOptions) {
        if (requestOptions === void 0) { requestOptions = { params: { f: "json" } }; }
        var options = __assign$1(__assign$1(__assign$1({ httpMethod: "POST" }, DEFAULT_ARCGIS_REQUEST_OPTIONS), requestOptions), {
            params: __assign$1(__assign$1({}, DEFAULT_ARCGIS_REQUEST_OPTIONS.params), requestOptions.params),
            headers: __assign$1(__assign$1({}, DEFAULT_ARCGIS_REQUEST_OPTIONS.headers), requestOptions.headers)
        });
        var missingGlobals = [];
        var recommendedPackages = [];
        // don't check for a global fetch if a custom implementation was passed through
        if (!options.fetch && typeof fetch !== "undefined") {
            options.fetch = fetch.bind(Function("return this")());
        }
        else {
            missingGlobals.push("`fetch`");
            recommendedPackages.push("`node-fetch`");
        }
        if (typeof Promise === "undefined") {
            missingGlobals.push("`Promise`");
            recommendedPackages.push("`es6-promise`");
        }
        if (typeof FormData === "undefined") {
            missingGlobals.push("`FormData`");
            recommendedPackages.push("`isomorphic-form-data`");
        }
        if (!options.fetch ||
            typeof Promise === "undefined" ||
            typeof FormData === "undefined") {
            throw new Error("`arcgis-rest-request` requires a `fetch` implementation and global variables for `Promise` and `FormData` to be present in the global scope. You are missing " + missingGlobals.join(", ") + ". We recommend installing the " + recommendedPackages.join(", ") + " modules at the root of your application to add these to the global scope. See https://bit.ly/2KNwWaJ for more info.");
        }
        var httpMethod = options.httpMethod, authentication = options.authentication, rawResponse = options.rawResponse;
        var params = __assign$1({ f: "json" }, options.params);
        var originalAuthError = null;
        var fetchOptions = {
            method: httpMethod,
            /* ensures behavior mimics XMLHttpRequest.
            needed to support sending IWA cookies */
            credentials: "same-origin"
        };
        return (authentication
            ? authentication.getToken(url, { fetch: options.fetch }).catch(function (err) {
                /**
                 * append original request url and requestOptions
                 * to the error thrown by getToken()
                 * to assist with retrying
                 */
                err.url = url;
                err.options = options;
                /**
                 * if an attempt is made to talk to an unfederated server
                 * first try the request anonymously. if a 'token required'
                 * error is thrown, throw the UNFEDERATED error then.
                 */
                originalAuthError = err;
                return Promise.resolve("");
            })
            : Promise.resolve(""))
            .then(function (token) {
            if (token.length) {
                params.token = token;
            }
            // Custom headers to add to request. IRequestOptions.headers with merge over requestHeaders.
            var requestHeaders = {};
            if (fetchOptions.method === "GET") {
                // Prevents token from being passed in query params when hideToken option is used.
                /* istanbul ignore if - window is always defined in a browser. Test case is covered by Jasmine in node test */
                if (params.token && options.hideToken &&
                    // Sharing API does not support preflight check required by modern browsers https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request
                    typeof window === 'undefined') {
                    requestHeaders["X-Esri-Authorization"] = "Bearer " + params.token;
                    delete params.token;
                }
                // encode the parameters into the query string
                var queryParams = encodeQueryString(params);
                // dont append a '?' unless parameters are actually present
                var urlWithQueryString = queryParams === "" ? url : url + "?" + encodeQueryString(params);
                if (
                // This would exceed the maximum length for URLs specified by the consumer and requires POST
                (options.maxUrlLength &&
                    urlWithQueryString.length > options.maxUrlLength) ||
                    // Or if the customer requires the token to be hidden and it has not already been hidden in the header (for browsers)
                    (params.token && options.hideToken)) {
                    // the consumer specified a maximum length for URLs
                    // and this would exceed it, so use post instead
                    fetchOptions.method = "POST";
                    // If the token was already added as a Auth header, add the token back to body with other params instead of header
                    if (token.length && options.hideToken) {
                        params.token = token;
                        // Remove existing header that was added before url query length was checked
                        delete requestHeaders["X-Esri-Authorization"];
                    }
                }
                else {
                    // just use GET
                    url = urlWithQueryString;
                }
            }
            /* updateResources currently requires FormData even when the input parameters dont warrant it.
        https://developers.arcgis.com/rest/users-groups-and-items/update-resources.htm
            see https://github.com/Esri/arcgis-rest-js/pull/500 for more info. */
            var forceFormData = new RegExp("/items/.+/updateResources").test(url);
            if (fetchOptions.method === "POST") {
                fetchOptions.body = encodeFormData(params, forceFormData);
            }
            // Mixin headers from request options
            fetchOptions.headers = __assign$1(__assign$1({}, requestHeaders), options.headers);
            /* istanbul ignore next - karma reports coverage on browser tests only */
            if (typeof window === "undefined" && !fetchOptions.headers.referer) {
                fetchOptions.headers.referer = NODEJS_DEFAULT_REFERER_HEADER;
            }
            /* istanbul ignore else blob responses are difficult to make cross platform we will just have to trust the isomorphic fetch will do its job */
            if (!requiresFormData(params) && !forceFormData) {
                fetchOptions.headers["Content-Type"] =
                    "application/x-www-form-urlencoded";
            }
            return options.fetch(url, fetchOptions);
        })
            .then(function (response) {
            if (!response.ok) {
                // server responded w/ an actual error (404, 500, etc)
                var status_1 = response.status, statusText = response.statusText;
                throw new ArcGISRequestError(statusText, "HTTP " + status_1, response, url, options);
            }
            if (rawResponse) {
                return response;
            }
            switch (params.f) {
                case "json":
                    return response.json();
                case "geojson":
                    return response.json();
                case "html":
                    return response.text();
                case "text":
                    return response.text();
                /* istanbul ignore next blob responses are difficult to make cross platform we will just have to trust that isomorphic fetch will do its job */
                default:
                    return response.blob();
            }
        })
            .then(function (data) {
            if ((params.f === "json" || params.f === "geojson") && !rawResponse) {
                var response = checkForErrors(data, url, params, options, originalAuthError);
                if (originalAuthError) {
                    /* if the request was made to an unfederated service that
                    didnt require authentication, add the base url and a dummy token
                    to the list of trusted servers to avoid another federation check
                    in the event of a repeat request */
                    var truncatedUrl = url
                        .toLowerCase()
                        .split(/\/rest(\/admin)?\/services\//)[0];
                    options.authentication.trustedServers[truncatedUrl] = {
                        token: [],
                        // default to 24 hours
                        expires: new Date(Date.now() + 86400 * 1000)
                    };
                    originalAuthError = null;
                }
                return response;
            }
            else {
                return data;
            }
        });
    }

    /* Copyright (c) 2018 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    /**
     * Helper method to ensure that user supplied urls don't include whitespace or a trailing slash.
     */
    function cleanUrl(url) {
        // Guard so we don't try to trim something that's not a string
        if (typeof url !== "string") {
            return url;
        }
        // trim leading and trailing spaces, but not spaces inside the url
        url = url.trim();
        // remove the trailing slash to the url if one was included
        if (url[url.length - 1] === "/") {
            url = url.slice(0, -1);
        }
        return url;
    }

    /* Copyright (c) 2017-2020 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    function decodeParam(param) {
        var _a = param.split("="), key = _a[0], value = _a[1];
        return { key: decodeURIComponent(key), value: decodeURIComponent(value) };
    }
    /**
     * Decodes the passed query string as an object.
     *
     * @param query A string to be decoded.
     * @returns A decoded query param object.
     */
    function decodeQueryString(query) {
        return query
            .replace(/^#/, "")
            .split("&")
            .reduce(function (acc, entry) {
            var _a = decodeParam(entry), key = _a.key, value = _a.value;
            acc[key] = value;
            return acc;
        }, {});
    }

    /* Copyright (c) 2017 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    function fetchToken(url, requestOptions) {
        var options = requestOptions;
        // we generate a response, so we can't return the raw response
        options.rawResponse = false;
        return request(url, options).then(function (response) {
            var r = {
                token: response.access_token,
                username: response.username,
                expires: new Date(
                // convert seconds in response to milliseconds and add the value to the current time to calculate a static expiration timestamp
                Date.now() + (response.expires_in * 1000 - 1000)),
                ssl: response.ssl === true
            };
            if (response.refresh_token) {
                r.refreshToken = response.refresh_token;
            }
            return r;
        });
    }

    /* Copyright (c) 2017-2018 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    function generateToken(url, requestOptions) {
        var options = requestOptions;
        /* istanbul ignore else */
        if (typeof window !== "undefined" &&
            window.location &&
            window.location.host) {
            options.params.referer = window.location.host;
        }
        else {
            options.params.referer = NODEJS_DEFAULT_REFERER_HEADER;
        }
        return request(url, options);
    }

    /**
     * Used to test if a URL is an ArcGIS Online URL
     */
    var arcgisOnlineUrlRegex = /^https?:\/\/(\S+)\.arcgis\.com.+/;
    function isOnline(url) {
        return arcgisOnlineUrlRegex.test(url);
    }
    function normalizeOnlinePortalUrl(portalUrl) {
        if (!arcgisOnlineUrlRegex.test(portalUrl)) {
            return portalUrl;
        }
        switch (getOnlineEnvironment(portalUrl)) {
            case "dev":
                return "https://devext.arcgis.com/sharing/rest";
            case "qa":
                return "https://qaext.arcgis.com/sharing/rest";
            default:
                return "https://www.arcgis.com/sharing/rest";
        }
    }
    function getOnlineEnvironment(url) {
        if (!arcgisOnlineUrlRegex.test(url)) {
            return null;
        }
        var match = url.match(arcgisOnlineUrlRegex);
        var subdomain = match[1].split(".").pop();
        if (subdomain.includes("dev")) {
            return "dev";
        }
        if (subdomain.includes("qa")) {
            return "qa";
        }
        return "production";
    }
    function isFederated(owningSystemUrl, portalUrl) {
        var normalizedPortalUrl = cleanUrl(normalizeOnlinePortalUrl(portalUrl)).replace(/https?:\/\//, "");
        var normalizedOwningSystemUrl = cleanUrl(owningSystemUrl).replace(/https?:\/\//, "");
        return new RegExp(normalizedOwningSystemUrl, "i").test(normalizedPortalUrl);
    }
    function canUseOnlineToken(portalUrl, requestUrl) {
        var portalIsOnline = isOnline(portalUrl);
        var requestIsOnline = isOnline(requestUrl);
        var portalEnv = getOnlineEnvironment(portalUrl);
        var requestEnv = getOnlineEnvironment(requestUrl);
        if (portalIsOnline && requestIsOnline && portalEnv === requestEnv) {
            return true;
        }
        return false;
    }

    /* Copyright (c) 2017-2019 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    function defer() {
        var deferred = {
            promise: null,
            resolve: null,
            reject: null
        };
        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        return deferred;
    }
    /**
     * ```js
     * import { UserSession } from '@esri/arcgis-rest-auth';
     * UserSession.beginOAuth2({
     *   // register an app of your own to create a unique clientId
     *   clientId: "abc123",
     *   redirectUri: 'https://yourapp.com/authenticate.html'
     * })
     *   .then(session)
     * // or
     * new UserSession({
     *   username: "jsmith",
     *   password: "123456"
     * })
     * // or
     * UserSession.deserialize(cache)
     * ```
     * Used to authenticate both ArcGIS Online and ArcGIS Enterprise users. `UserSession` includes helper methods for [OAuth 2.0](/arcgis-rest-js/guides/browser-authentication/) in both browser and server applications.
     */
    var UserSession = /** @class */ (function () {
        function UserSession(options) {
            this.clientId = options.clientId;
            this._refreshToken = options.refreshToken;
            this._refreshTokenExpires = options.refreshTokenExpires;
            this.username = options.username;
            this.password = options.password;
            this._token = options.token;
            this._tokenExpires = options.tokenExpires;
            this.portal = options.portal
                ? cleanUrl(options.portal)
                : "https://www.arcgis.com/sharing/rest";
            this.ssl = options.ssl;
            this.provider = options.provider || "arcgis";
            this.tokenDuration = options.tokenDuration || 20160;
            this.redirectUri = options.redirectUri;
            this.refreshTokenTTL = options.refreshTokenTTL || 1440;
            this.trustedServers = {};
            // if a non-federated server was passed explicitly, it should be trusted.
            if (options.server) {
                // if the url includes more than '/arcgis/', trim the rest
                var root = this.getServerRootUrl(options.server);
                this.trustedServers[root] = {
                    token: options.token,
                    expires: options.tokenExpires
                };
            }
            this._pendingTokenRequests = {};
        }
        /**
         * Begins a new browser-based OAuth 2.0 sign in. If `options.popup` is `true` the
         * authentication window will open in a new tab/window otherwise the user will
         * be redirected to the authorization page in their current tab/window.
         *
         * @browserOnly
         */
        /* istanbul ignore next */
        UserSession.beginOAuth2 = function (options, win) {
            if (win === void 0) { win = window; }
            var _a = __assign({
                portal: "https://www.arcgis.com/sharing/rest",
                provider: "arcgis",
                duration: 20160,
                popup: true,
                state: options.clientId,
                locale: ""
            }, options), portal = _a.portal, provider = _a.provider, clientId = _a.clientId, duration = _a.duration, redirectUri = _a.redirectUri, popup = _a.popup, state = _a.state, locale = _a.locale, params = _a.params;
            var url;
            if (provider === "arcgis") {
                url = portal + "/oauth2/authorize?client_id=" + clientId + "&response_type=token&expiration=" + duration + "&redirect_uri=" + encodeURIComponent(redirectUri) + "&state=" + state + "&locale=" + locale;
            }
            else {
                url = portal + "/oauth2/social/authorize?client_id=" + clientId + "&socialLoginProviderName=" + provider + "&autoAccountCreateForSocial=true&response_type=token&expiration=" + duration + "&redirect_uri=" + encodeURIComponent(redirectUri) + "&state=" + state + "&locale=" + locale;
            }
            // append additional params
            if (params) {
                url = url + "&" + encodeQueryString(params);
            }
            if (!popup) {
                win.location.href = url;
                return undefined;
            }
            var session = defer();
            win["__ESRI_REST_AUTH_HANDLER_" + clientId] = function (errorString, oauthInfoString) {
                if (errorString) {
                    var error = JSON.parse(errorString);
                    session.reject(new ArcGISAuthError(error.errorMessage, error.error));
                    return;
                }
                if (oauthInfoString) {
                    var oauthInfo = JSON.parse(oauthInfoString);
                    session.resolve(new UserSession({
                        clientId: clientId,
                        portal: portal,
                        ssl: oauthInfo.ssl,
                        token: oauthInfo.token,
                        tokenExpires: new Date(oauthInfo.expires),
                        username: oauthInfo.username
                    }));
                }
            };
            win.open(url, "oauth-window", "height=400,width=600,menubar=no,location=yes,resizable=yes,scrollbars=yes,status=yes");
            return session.promise;
        };
        /**
         * Completes a browser-based OAuth 2.0  in. If `options.popup` is `true` the user
         * will be returned to the previous window. Otherwise a new `UserSession`
         * will be returned. You must pass the same values for `options.popup` and
         * `options.portal` as you used in `beginOAuth2()`.
         *
         * @browserOnly
         */
        /* istanbul ignore next */
        UserSession.completeOAuth2 = function (options, win) {
            if (win === void 0) { win = window; }
            var _a = __assign({ portal: "https://www.arcgis.com/sharing/rest", popup: true }, options), portal = _a.portal, clientId = _a.clientId, popup = _a.popup;
            function completeSignIn(error, oauthInfo) {
                try {
                    var handlerFn = void 0;
                    var handlerFnName = "__ESRI_REST_AUTH_HANDLER_" + clientId;
                    if (popup) {
                        // Guard b/c IE does not support window.opener
                        if (win.opener) {
                            if (win.opener.parent && win.opener.parent[handlerFnName]) {
                                handlerFn = win.opener.parent[handlerFnName];
                            }
                            else if (win.opener && win.opener[handlerFnName]) {
                                // support pop-out oauth from within an iframe
                                handlerFn = win.opener[handlerFnName];
                            }
                        }
                        else {
                            // IE
                            if (win !== win.parent && win.parent && win.parent[handlerFnName]) {
                                handlerFn = win.parent[handlerFnName];
                            }
                        }
                        // if we have a handler fn, call it and close the window
                        if (handlerFn) {
                            handlerFn(error ? JSON.stringify(error) : undefined, JSON.stringify(oauthInfo));
                            win.close();
                            return undefined;
                        }
                    }
                }
                catch (e) {
                    throw new ArcGISAuthError("Unable to complete authentication. It's possible you specified popup based oAuth2 but no handler from \"beginOAuth2()\" present. This generally happens because the \"popup\" option differs between \"beginOAuth2()\" and \"completeOAuth2()\".");
                }
                if (error) {
                    throw new ArcGISAuthError(error.errorMessage, error.error);
                }
                return new UserSession({
                    clientId: clientId,
                    portal: portal,
                    ssl: oauthInfo.ssl,
                    token: oauthInfo.token,
                    tokenExpires: oauthInfo.expires,
                    username: oauthInfo.username
                });
            }
            var params = decodeQueryString(win.location.hash);
            if (!params.access_token) {
                var error = void 0;
                var errorMessage = "Unknown error";
                if (params.error) {
                    error = params.error;
                    errorMessage = params.error_description;
                }
                return completeSignIn({ error: error, errorMessage: errorMessage });
            }
            var token = params.access_token;
            var expires = new Date(Date.now() + parseInt(params.expires_in, 10) * 1000 - 60 * 1000);
            var username = params.username;
            var ssl = params.ssl === "true";
            return completeSignIn(undefined, {
                token: token,
                expires: expires,
                ssl: ssl,
                username: username
            });
        };
        /**
         * Begins a new server-based OAuth 2.0 sign in. This will redirect the user to
         * the ArcGIS Online or ArcGIS Enterprise authorization page.
         *
         * @nodeOnly
         */
        UserSession.authorize = function (options, response) {
            var _a = __assign({ portal: "https://arcgis.com/sharing/rest", duration: 20160 }, options), portal = _a.portal, clientId = _a.clientId, duration = _a.duration, redirectUri = _a.redirectUri;
            response.writeHead(301, {
                Location: portal + "/oauth2/authorize?client_id=" + clientId + "&duration=" + duration + "&response_type=code&redirect_uri=" + encodeURIComponent(redirectUri)
            });
            response.end();
        };
        /**
         * Completes the server-based OAuth 2.0 sign in process by exchanging the `authorizationCode`
         * for a `access_token`.
         *
         * @nodeOnly
         */
        UserSession.exchangeAuthorizationCode = function (options, authorizationCode) {
            var _a = __assign({
                portal: "https://www.arcgis.com/sharing/rest",
                refreshTokenTTL: 1440
            }, options), portal = _a.portal, clientId = _a.clientId, redirectUri = _a.redirectUri, refreshTokenTTL = _a.refreshTokenTTL;
            return fetchToken(portal + "/oauth2/token", {
                params: {
                    grant_type: "authorization_code",
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    code: authorizationCode
                }
            }).then(function (response) {
                return new UserSession({
                    clientId: clientId,
                    portal: portal,
                    ssl: response.ssl,
                    redirectUri: redirectUri,
                    refreshToken: response.refreshToken,
                    refreshTokenTTL: refreshTokenTTL,
                    refreshTokenExpires: new Date(Date.now() + (refreshTokenTTL - 1) * 1000),
                    token: response.token,
                    tokenExpires: response.expires,
                    username: response.username
                });
            });
        };
        UserSession.deserialize = function (str) {
            var options = JSON.parse(str);
            return new UserSession({
                clientId: options.clientId,
                refreshToken: options.refreshToken,
                refreshTokenExpires: new Date(options.refreshTokenExpires),
                username: options.username,
                password: options.password,
                token: options.token,
                tokenExpires: new Date(options.tokenExpires),
                portal: options.portal,
                ssl: options.ssl,
                tokenDuration: options.tokenDuration,
                redirectUri: options.redirectUri,
                refreshTokenTTL: options.refreshTokenTTL
            });
        };
        /**
         * Translates authentication from the format used in the [ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/).
         *
         * ```js
         * UserSession.fromCredential({
         *   userId: "jsmith",
         *   token: "secret"
         * });
         * ```
         *
         * @returns UserSession
         */
        UserSession.fromCredential = function (credential) {
            return new UserSession({
                portal: credential.server.includes("sharing/rest")
                    ? credential.server
                    : credential.server + "/sharing/rest",
                ssl: credential.ssl,
                token: credential.token,
                username: credential.userId,
                tokenExpires: new Date(credential.expires)
            });
        };
        Object.defineProperty(UserSession.prototype, "token", {
            /**
             * The current ArcGIS Online or ArcGIS Enterprise `token`.
             */
            get: function () {
                return this._token;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(UserSession.prototype, "tokenExpires", {
            /**
             * The expiration time of the current `token`.
             */
            get: function () {
                return this._tokenExpires;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(UserSession.prototype, "refreshToken", {
            /**
             * The current token to ArcGIS Online or ArcGIS Enterprise.
             */
            get: function () {
                return this._refreshToken;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(UserSession.prototype, "refreshTokenExpires", {
            /**
             * The expiration time of the current `refreshToken`.
             */
            get: function () {
                return this._refreshTokenExpires;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Returns authentication in a format useable in the [ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/).
         *
         * ```js
         * esriId.registerToken(session.toCredential());
         * ```
         *
         * @returns ICredential
         */
        UserSession.prototype.toCredential = function () {
            return {
                expires: this.tokenExpires.getTime(),
                server: this.portal,
                ssl: this.ssl,
                token: this.token,
                userId: this.username
            };
        };
        /**
         * Returns information about the currently logged in [user](https://developers.arcgis.com/rest/users-groups-and-items/user.htm). Subsequent calls will *not* result in additional web traffic.
         *
         * ```js
         * session.getUser()
         *   .then(response => {
         *     console.log(response.role); // "org_admin"
         *   })
         * ```
         *
         * @param requestOptions - Options for the request. NOTE: `rawResponse` is not supported by this operation.
         * @returns A Promise that will resolve with the data from the response.
         */
        UserSession.prototype.getUser = function (requestOptions) {
            var _this = this;
            if (this._pendingUserRequest) {
                return this._pendingUserRequest;
            }
            else if (this._user) {
                return Promise.resolve(this._user);
            }
            else {
                var url = this.portal + "/community/self";
                var options = __assign(__assign({ httpMethod: "GET", authentication: this }, requestOptions), { rawResponse: false });
                this._pendingUserRequest = request(url, options).then(function (response) {
                    _this._user = response;
                    _this._pendingUserRequest = null;
                    return response;
                });
                return this._pendingUserRequest;
            }
        };
        /**
         * Returns the username for the currently logged in [user](https://developers.arcgis.com/rest/users-groups-and-items/user.htm). Subsequent calls will *not* result in additional web traffic. This is also used internally when a username is required for some requests but is not present in the options.
         *
         *    * ```js
         * session.getUsername()
         *   .then(response => {
         *     console.log(response); // "casey_jones"
         *   })
         * ```
         */
        UserSession.prototype.getUsername = function () {
            if (this.username) {
                return Promise.resolve(this.username);
            }
            else if (this._user) {
                return Promise.resolve(this._user.username);
            }
            else {
                return this.getUser().then(function (user) {
                    return user.username;
                });
            }
        };
        /**
         * Gets an appropriate token for the given URL. If `portal` is ArcGIS Online and
         * the request is to an ArcGIS Online domain `token` will be used. If the request
         * is to the current `portal` the current `token` will also be used. However if
         * the request is to an unknown server we will validate the server with a request
         * to our current `portal`.
         */
        UserSession.prototype.getToken = function (url, requestOptions) {
            if (canUseOnlineToken(this.portal, url)) {
                return this.getFreshToken(requestOptions);
            }
            else if (new RegExp(this.portal, "i").test(url)) {
                return this.getFreshToken(requestOptions);
            }
            else {
                return this.getTokenForServer(url, requestOptions);
            }
        };
        UserSession.prototype.toJSON = function () {
            return {
                clientId: this.clientId,
                refreshToken: this.refreshToken,
                refreshTokenExpires: this.refreshTokenExpires,
                username: this.username,
                password: this.password,
                token: this.token,
                tokenExpires: this.tokenExpires,
                portal: this.portal,
                ssl: this.ssl,
                tokenDuration: this.tokenDuration,
                redirectUri: this.redirectUri,
                refreshTokenTTL: this.refreshTokenTTL
            };
        };
        UserSession.prototype.serialize = function () {
            return JSON.stringify(this);
        };
        /**
         * Manually refreshes the current `token` and `tokenExpires`.
         */
        UserSession.prototype.refreshSession = function (requestOptions) {
            // make sure subsequent calls to getUser() don't returned cached metadata
            this._user = null;
            if (this.username && this.password) {
                return this.refreshWithUsernameAndPassword(requestOptions);
            }
            if (this.clientId && this.refreshToken) {
                return this.refreshWithRefreshToken();
            }
            return Promise.reject(new ArcGISAuthError("Unable to refresh token."));
        };
        /**
         * Determines the root of the ArcGIS Server or Portal for a given URL.
         *
         * @param url the URl to determine the root url for.
         */
        UserSession.prototype.getServerRootUrl = function (url) {
            var root = cleanUrl(url).split(/\/rest(\/admin)?\/services(?:\/|#|\?|$)/)[0];
            var _a = root.match(/(https?:\/\/)(.+)/), match = _a[0], protocol = _a[1], domainAndPath = _a[2];
            var _b = domainAndPath.split("/"), domain = _b[0], path = _b.slice(1);
            // only the domain is lowercased becasue in some cases an org id might be
            // in the path which cannot be lowercased.
            return "" + protocol + domain.toLowerCase() + "/" + path.join("/");
        };
        /**
         * Validates that a given URL is properly federated with our current `portal`.
         * Attempts to use the internal `trustedServers` cache first.
         */
        UserSession.prototype.getTokenForServer = function (url, requestOptions) {
            var _this = this;
            // requests to /rest/services/ and /rest/admin/services/ are both valid
            // Federated servers may have inconsistent casing, so lowerCase it
            var root = this.getServerRootUrl(url);
            var existingToken = this.trustedServers[root];
            if (existingToken &&
                existingToken.expires &&
                existingToken.expires.getTime() > Date.now()) {
                return Promise.resolve(existingToken.token);
            }
            if (this._pendingTokenRequests[root]) {
                return this._pendingTokenRequests[root];
            }
            this._pendingTokenRequests[root] = request(root + "/rest/info")
                .then(function (response) {
                if (response.owningSystemUrl) {
                    /**
                     * if this server is not owned by this portal
                     * bail out with an error since we know we wont
                     * be able to generate a token
                     */
                    if (!isFederated(response.owningSystemUrl, _this.portal)) {
                        throw new ArcGISAuthError(url + " is not federated with " + _this.portal + ".", "NOT_FEDERATED");
                    }
                    else {
                        /**
                         * if the server is federated, use the relevant token endpoint.
                         */
                        return request(response.owningSystemUrl + "/sharing/rest/info", requestOptions);
                    }
                }
                else if (response.authInfo &&
                    _this.trustedServers[root] !== undefined) {
                    /**
                     * if its a stand-alone instance of ArcGIS Server that doesn't advertise
                     * federation, but the root server url is recognized, use its built in token endpoint.
                     */
                    return Promise.resolve({ authInfo: response.authInfo });
                }
                else {
                    throw new ArcGISAuthError(url + " is not federated with any portal and is not explicitly trusted.", "NOT_FEDERATED");
                }
            })
                .then(function (response) {
                return response.authInfo.tokenServicesUrl;
            })
                .then(function (tokenServicesUrl) {
                // an expired token cant be used to generate a new token
                if (_this.token && _this.tokenExpires.getTime() > Date.now()) {
                    return generateToken(tokenServicesUrl, {
                        params: {
                            token: _this.token,
                            serverUrl: url,
                            expiration: _this.tokenDuration,
                            client: "referer"
                        }
                    });
                    // generate an entirely fresh token if necessary
                }
                else {
                    return generateToken(tokenServicesUrl, {
                        params: {
                            username: _this.username,
                            password: _this.password,
                            expiration: _this.tokenDuration,
                            client: "referer"
                        }
                    }).then(function (response) {
                        _this._token = response.token;
                        _this._tokenExpires = new Date(response.expires);
                        return response;
                    });
                }
            })
                .then(function (response) {
                _this.trustedServers[root] = {
                    expires: new Date(response.expires),
                    token: response.token
                };
                delete _this._pendingTokenRequests[root];
                return response.token;
            });
            return this._pendingTokenRequests[root];
        };
        /**
         * Returns an unexpired token for the current `portal`.
         */
        UserSession.prototype.getFreshToken = function (requestOptions) {
            var _this = this;
            if (this.token && !this.tokenExpires) {
                return Promise.resolve(this.token);
            }
            if (this.token &&
                this.tokenExpires &&
                this.tokenExpires.getTime() > Date.now()) {
                return Promise.resolve(this.token);
            }
            if (!this._pendingTokenRequests[this.portal]) {
                this._pendingTokenRequests[this.portal] = this.refreshSession(requestOptions).then(function (session) {
                    _this._pendingTokenRequests[_this.portal] = null;
                    return session.token;
                });
            }
            return this._pendingTokenRequests[this.portal];
        };
        /**
         * Refreshes the current `token` and `tokenExpires` with `username` and
         * `password`.
         */
        UserSession.prototype.refreshWithUsernameAndPassword = function (requestOptions) {
            var _this = this;
            var options = __assign({ params: {
                    username: this.username,
                    password: this.password,
                    expiration: this.tokenDuration
                } }, requestOptions);
            return generateToken(this.portal + "/generateToken", options).then(function (response) {
                _this._token = response.token;
                _this._tokenExpires = new Date(response.expires);
                return _this;
            });
        };
        /**
         * Refreshes the current `token` and `tokenExpires` with `refreshToken`.
         */
        UserSession.prototype.refreshWithRefreshToken = function (requestOptions) {
            var _this = this;
            if (this.refreshToken &&
                this.refreshTokenExpires &&
                this.refreshTokenExpires.getTime() < Date.now()) {
                return this.refreshRefreshToken(requestOptions);
            }
            var options = __assign({ params: {
                    client_id: this.clientId,
                    refresh_token: this.refreshToken,
                    grant_type: "refresh_token"
                } }, requestOptions);
            return fetchToken(this.portal + "/oauth2/token", options).then(function (response) {
                _this._token = response.token;
                _this._tokenExpires = response.expires;
                return _this;
            });
        };
        /**
         * Exchanges an unexpired `refreshToken` for a new one, also updates `token` and
         * `tokenExpires`.
         */
        UserSession.prototype.refreshRefreshToken = function (requestOptions) {
            var _this = this;
            var options = __assign({ params: {
                    client_id: this.clientId,
                    refresh_token: this.refreshToken,
                    redirect_uri: this.redirectUri,
                    grant_type: "exchange_refresh_token"
                } }, requestOptions);
            return fetchToken(this.portal + "/oauth2/token", options).then(function (response) {
                _this._token = response.token;
                _this._tokenExpires = response.expires;
                _this._refreshToken = response.refreshToken;
                _this._refreshTokenExpires = new Date(Date.now() + (_this.refreshTokenTTL - 1) * 60 * 1000);
                return _this;
            });
        };
        return UserSession;
    }());

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$2 = function() {
        __assign$2 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$2.apply(this, arguments);
    };

    /* Copyright (c) 2017 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    // https always
    var ARCGIS_ONLINE_GEOCODING_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/";

    /* Copyright (c) 2017-2018 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */
    /**
     * ```js
     * import { bulkGeocode } from '@esri/arcgis-rest-geocoding';
     * import { ApplicationSession } from '@esri/arcgis-rest-auth';
     * //
     * const addresses = [
     *   { "OBJECTID": 1, "SingleLine": "380 New York Street 92373" },
     *   { "OBJECTID": 2, "SingleLine": "1 World Way Los Angeles 90045" }
     * ];
     * //
     * bulkGeocode({ addresses, authentication: session })
     *   .then((response) => {
     *     response.locations[0].location; // => { x: -117, y: 34, spatialReference: { wkid: 4326 } }
     *   });
     * ```
     * Used to geocode a [batch](https://developers.arcgis.com/rest/geocode/api-reference/geocoding-geocode-addresses.htm) of addresses.
     *
     * @param requestOptions - Request options to pass to the geocoder, including an array of addresses and authentication session.
     * @returns A Promise that will resolve with the data from the response. The spatial reference will be added to address locations unless `rawResponse: true` was passed.
     */
    function bulkGeocode(requestOptions // must POST, which is the default
    ) {
        var options = __assign$2({ endpoint: ARCGIS_ONLINE_GEOCODING_URL, params: {} }, requestOptions);
        options.params.addresses = {
            records: requestOptions.addresses.map(function (address) {
                return { attributes: address };
            })
        };
        // the SAS service doesnt support anonymous requests
        if (!requestOptions.authentication &&
            options.endpoint === ARCGIS_ONLINE_GEOCODING_URL) {
            return Promise.reject("bulk geocoding using the ArcGIS service requires authentication");
        }
        return request(cleanUrl(options.endpoint) + "/geocodeAddresses", options).then(function (response) {
            if (options.rawResponse) {
                return response;
            }
            var sr = response.spatialReference;
            response.locations.forEach(function (address) {
                if (address.location) {
                    address.location.spatialReference = sr;
                }
            });
            return response;
        });
    }

    function Geocode (columnInfos, data) {
        return new Promise((resolve, reject) => {
            UserSession.beginOAuth2({
                // register an app of your own to create a unique clientId
                clientId: "3pW9jYgk9S8xBkgM",
                redirectUri: "http://localhost:5000/callback.html",
                popup: true,
            }).then((authentication) => {
                let addresses = data.map((row, i) => {
                    let geocodingOptions = { OBJECTID: i };
                    columnInfos.forEach((columnInfo) => {
                        if (columnInfo.geocodingAttribute !== "") {
                            geocodingOptions[columnInfo.geocodingAttribute] =
                                row[columnInfo.column];
                        }
                    });
                    return geocodingOptions;
                });
                bulkGeocode({
                    addresses,
                    authentication,
                }).then((response) => {
                    const mergedData = Object.assign([], data);
                    response.locations.forEach((locationInfo) => {
                        if (locationInfo.hasOwnProperty("location")) {
                            mergedData[locationInfo.attributes.ResultID].x =
                                locationInfo.location.x;
                            mergedData[locationInfo.attributes.ResultID].y =
                                locationInfo.location.y;
                        }
                        else {
                            mergedData[locationInfo.attributes.ResultID].x = 0;
                            mergedData[locationInfo.attributes.ResultID].y = 0;
                        }
                        mergedData[locationInfo.attributes.ResultID].score =
                            locationInfo.score;
                    });
                    resolve(mergedData);
                }, (err) => {
                    reject(err);
                });
            });
        });
    }

    /* src\App.svelte generated by Svelte v3.29.0 */

    const { console: console_1 } = globals;
    const file$1 = "src\\App.svelte";

    // (73:2) {#if geocodeResultsCSVURL}
    function create_if_block$1(ctx) {
    	let a;
    	let t;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text("Download\n      Results!");
    			attr_dev(a, "download", "geocodeResults.csv");
    			attr_dev(a, "href", /*geocodeResultsCSVURL*/ ctx[2]);
    			add_location(a, file$1, 73, 4, 2074);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*geocodeResultsCSVURL*/ 4) {
    				attr_dev(a, "href", /*geocodeResultsCSVURL*/ ctx[2]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(73:2) {#if geocodeResultsCSVURL}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let h20;
    	let t3;
    	let h21;
    	let t5;
    	let form;
    	let input0;
    	let t6;
    	let input1;
    	let t7;
    	let choosecolumns;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	choosecolumns = new ChooseColumns({
    			props: { columns: /*columns*/ ctx[1] },
    			$$inline: true
    		});

    	choosecolumns.$on("geocode", /*handleGeocode*/ ctx[4]);
    	let if_block = /*geocodeResultsCSVURL*/ ctx[2] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "*ALPHA* Geocode with ArcGIS *ALPHA*";
    			t1 = space();
    			h20 = element("h2");
    			h20.textContent = "Upload CSV > Download Results as CSV";
    			t3 = space();
    			h21 = element("h2");
    			h21.textContent = "*ALPHA SOFTWARE - DO NOT USE THIS UNLESS YOU KNOW WHAT YOU'RE DOING*";
    			t5 = space();
    			form = element("form");
    			input0 = element("input");
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			create_component(choosecolumns.$$.fragment);
    			t8 = space();
    			if (if_block) if_block.c();
    			attr_dev(h1, "class", "svelte-1e9puaw");
    			add_location(h1, file$1, 64, 2, 1653);
    			add_location(h20, file$1, 65, 2, 1700);
    			add_location(h21, file$1, 66, 2, 1748);
    			attr_dev(input0, "type", "file");
    			attr_dev(input0, "accept", "text/csv");
    			add_location(input0, file$1, 68, 4, 1869);
    			attr_dev(input1, "type", "submit");
    			input1.value = "Upload";
    			add_location(input1, file$1, 69, 4, 1935);
    			add_location(form, file$1, 67, 2, 1828);
    			attr_dev(main, "class", "svelte-1e9puaw");
    			add_location(main, file$1, 63, 0, 1644);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, h20);
    			append_dev(main, t3);
    			append_dev(main, h21);
    			append_dev(main, t5);
    			append_dev(main, form);
    			append_dev(form, input0);
    			/*input0_binding*/ ctx[5](input0);
    			append_dev(form, t6);
    			append_dev(form, input1);
    			append_dev(main, t7);
    			mount_component(choosecolumns, main, null);
    			append_dev(main, t8);
    			if (if_block) if_block.m(main, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", /*submitFormHandler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const choosecolumns_changes = {};
    			if (dirty & /*columns*/ 2) choosecolumns_changes.columns = /*columns*/ ctx[1];
    			choosecolumns.$set(choosecolumns_changes);

    			if (/*geocodeResultsCSVURL*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(choosecolumns.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(choosecolumns.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			/*input0_binding*/ ctx[5](null);
    			destroy_component(choosecolumns);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let fileInput;
    	let columns = [];
    	let csv;
    	let geocodeResultsCSV;
    	let geocodeResultsCSVURL;

    	const submitFormHandler = evt => {
    		evt.preventDefault();
    		const file = fileInput.files[0];

    		if (file) {
    			var reader = new FileReader();
    			reader.readAsText(file, "UTF-8");

    			reader.onload = function (e) {
    				console.log("result:", this.result);
    				const text = this.result;
    				const result = papaparse_min.parse(text, { header: true });
    				console.log("result", result);
    				$$invalidate(1, columns = result.meta.fields);
    				csv = result.data;
    			};

    			reader.onerror = function (evt) {
    				console.error("error!", evt);
    			};
    		}
    	};

    	const handleGeocode = evt => {
    		console.log("handleGeocode", evt.detail);

    		Geocode(evt.detail, csv).then(geocodeResults => {
    			console.log("geocodeResults!", geocodeResults);
    			geocodeResultsCSV = papaparse_min.unparse(geocodeResults);
    			var blob = new Blob(["﻿", geocodeResultsCSV]);
    			$$invalidate(2, geocodeResultsCSVURL = URL.createObjectURL(blob));
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			fileInput = $$value;
    			$$invalidate(0, fileInput);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		parse: papaparse_min.parse,
    		unparse: papaparse_min.unparse,
    		ParseResult: papaparse_min.ParseResult,
    		ChooseColumns,
    		Geocode,
    		fileInput,
    		columns,
    		csv,
    		geocodeResultsCSV,
    		geocodeResultsCSVURL,
    		submitFormHandler,
    		handleGeocode
    	});

    	$$self.$inject_state = $$props => {
    		if ("fileInput" in $$props) $$invalidate(0, fileInput = $$props.fileInput);
    		if ("columns" in $$props) $$invalidate(1, columns = $$props.columns);
    		if ("csv" in $$props) csv = $$props.csv;
    		if ("geocodeResultsCSV" in $$props) geocodeResultsCSV = $$props.geocodeResultsCSV;
    		if ("geocodeResultsCSVURL" in $$props) $$invalidate(2, geocodeResultsCSVURL = $$props.geocodeResultsCSVURL);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		fileInput,
    		columns,
    		geocodeResultsCSVURL,
    		submitFormHandler,
    		handleGeocode,
    		input0_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'world'
        }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

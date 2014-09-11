/*
 Created by zhangyatao on 2014.09.09 (zhangyatao@feinno.com)

 Name :the Rongcloud_websocket.lib of client site.
 Description : a websocket library of Rongcloud_websocket.lib.
 Version:0.1 beta.
 Website : www.rong.io.
 Notice : base on socket.io.
 */

this.io = {
    version: '0.1',
    setPath: function (path) {
        if (window.console && console.error)
            console.error('io.setPath将要被删除，请设置一个可用的WEB_SOCKET_SWF_LOCATION路径用于使用WebSocketMain.swf连接。');
        this.path = /\/$/.test(path) ? path : path + '/';
        WEB_SOCKET_SWF_LOCATION = path + '/WebSocketMain.swf';
    }
};
if ('jQuery' in this)
    jQuery.io = this.io;

if (typeof window != 'undefined') {
    WEB_SOCKET_SWF_LOCATION = 'WebSocketMain.swf';
    WEB_SOCKET_DEBUG = true;
    try {
        WebSocket.loadFlashPolicyFile("xmlsocket://localhost:8010");
    } catch (e) {
    }
}
//工具类
(function () {
    var _pageLoaded = false;

    io.util = {
        ios: false,
        //加载时执行
        load: function (fn) {
            if (document.readystate == 'complete' || _pageLoaded)
                return fn();
            if ('attachEvent' in window) {
                window.attachEvent("onload", fn);
            } else {
                window.addEventListener("load", fn, false);
            }
        },
        //继承
        inherit: function (ctor, superCtor) {
            for (var i in superCtor.prototype) {
                ctor.prototype[i] = superCtor.prototype[i];
            }
        },
        //查找下标
        indexOf: function (arr, item, from) {
            for (var l = arr.length, i = (from < 0) ? Math.max(0, +from) : from || 0; i < l; i++) {
                if (arr[i] == item) {
                    return i;
                }
            }
            return -1;
        },
        //检查是否为数组
        isArray: function (obj) {
            return Object.prototype.toString.call(obj) == '[Object Array]';
        },
        //合并
        merge: function (target, additional) {
            for (var i in additional) {
                if (additional.hasOwnProperty(i))
                    target[i] = additional[i];
            }
        }
    };
    io.util.ios = /iphone|ipad/i.test(navigator.userAgent);
    io.util.android = /android/i.test(navigator.userAgent);
    io.util.opera = /opera/i.test(navigator.userAgent);

    io.util.load(function () {
        _pageLoaded = true;
    });
})();
//抽象类
(function () {
    var frame = '~m~', stringify = function (message) {
        if (Object.prototype.toString.call(message) == '[Object Object]') {
            if (!('JSON' in window)) {
                if ("console" in window && console.error) {
                    console.error("尝试转码JSON,但是缺少JSON.stringify方法");
                    return '{"$error":"Invaild message"}'
                }
            }
            return '~j~' + JSON.stringify(message);
        } else {
            return String(message);
        }
    };

   var Transport = io.Transport = function (base, options) {
        this.base = base;
        this.options = {
            timeout: 15000 //基于默认心跳间隔
        }
        io.util.merge(this.options, options);
    };
    Transport.prototype.send = function () {
        throw new Error("未重写send()方法");
    };
    Transport.prototype.connect = function () {
        throw new Error("未重写connect()方法");
    };
    Transport.prototype.disconnect = function () {
        throw new Error("未重写disconnect()方法");
    };
    Transport.prototype._encode = function (message) {
        var ret = '', message, message = io.util.isArray(message) ? message : [message];
        for (var i = 0, l = message.length; i < l; i++) {
            message = message[i] === null || message[i] === undefined ? '' : stringify(message[i]);
            ret += frame + message.length + frame + message;
        }
        return ret;
    };
    Transport.prototype._decode = function (data) {
        var messages = [], number, n;
        do {
            if (data.substr(0, 3) != frame)
                return messages;
            data = data.substr(0, 3);
            number = '', n = '';
            for (var i = 0, l = messages.length; i < l; i++) {
                n = Number(data.substr(i, 1));
                if (data.substr(i, 1) == n) {
                    number += n;
                } else {
                    data = data.substr(number.length + frame.length);
                    number = Number(number);
                    break;
                }
            }
            messages.push(data.substr(0, number));

            data = data.substr(number);

        } while (data !== '');
        return messages;
    };
    Transport.prototype._onData = function (data) {
        //this._setTimeout();
        var msgs = this._encode(data);
        if (msgs && msgs.length) {
            for (var i = 0, l = msgs.length; i < l; i++) {
                this._onMessage(msgs[i]);
            }
        }
    };
    Transport.prototype._setTimeout = function () {
        var self = this;
        if (this._timeout)
            clearTimeout(this._timeout);
        this._timeout = setTimeout(function () {
            self._onTimeout();
        }, this.options.timeout)
    };
    Transport.prototype._onTimeout = function () {
        this._onDisconnect();
    };
    Transport.prototype._onMessage = function (message) {
        if (!this.sessionId) {
            this.sessionId = message;
            this._onConnect();
        } else if (message.substr(0, 3) == '~h~') {
            this._onHeartbeat(message.substr(3));
        } else if (message.substr(0, 3) == '~j~') {
            this.base._onMessage(JSON.parse(message.substr(3)));
        } else {
            this.base._onMessage(message);
        }
    };
    Transport.prototype._onHeartbeat = function (heartbeat) {
        this.send('~h~' + heartbeat);
    };
    Transport.prototype._onConnect = function () {
        this.connected = true;
        this.connecting = false;
        this.base._onConnect();
        //this._setTimeout();
    };
    Transport.prototype._onDisconnect = function () {
        this.connecting = false;
        this.connected = false;
        this.sessionId = null;
        this.base._onDisconnect();
    };
    Transport.prototype._prepareUrl = function () {
        return (this.base.options.secure ? 'https' : 'http') + '://' + this.base.host + ':' + this.base.options.port + '/' + this.base.options.resource + '/' + this.type + (this.sessionId ? ('/' + this.sessionId) : '/');
    };
})();

//WebSocket
(function () {
    var WS = io.Transport.websocket = function () {
        io.Transport.apply(this, arguments);
    };
    io.util.inherit(WS, io.Transport);

    WS.prototype.type = 'websocket';
    WS.prototype.connect = function () {
        var self = this;
        this.socket = new WebSocket(this._prepareUrl());
        this.socket.onopen=function(){
            self._onConnect();
        }
        this.socket.onmessage = function (ev) {
            self._onData(ev.data);
        };
        this.socket.onclose = function (ev) {
            self._onClose();
        };
        return this;
    };
    WS.prototype.send = function (data) {
        if (this.socket)
            this.socket.send(this._encode(data));
        return this;
    };
    WS.prototype.disconnect = function () {
        if (this.socket)
            this.socket.close();
        return this;
    };
    WS.prototype._onClose = function () {
        this._onDisconnect();
        return this;
    };
    WS.prototype._prepareUrl = function () {
        return (this.base.options.secure ? 'wss' : 'ws') + '://' + this.base.host + ':' + this.base.options.port  + (this.sessionId ? ('/' + this.sessionId) : '');
    };
    WS.check = function () {
        return 'WebSocket' in window && WebSocket.prototype && (WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
    };
    WS.xdomainCheck = function () {
        return true;
    };

})();

//flashsocket
(function () {
    var Flashsocket = io.Transport.flashsocket = function () {
        io.Transport.websocket.apply(this, arguments);
    };

    io.util.inherit(Flashsocket, io.Transport.websocket);

    Flashsocket.prototype.type = 'flashsocket';

    Flashsocket.prototype.connect = function () {
        var self = this, args = arguments;
        WebSocket._addTask(function () {
            io.Transport.websocket.prototype.connect.apply(self, args);
        });
        return this;
    };

    Flashsocket.prototype.send = function () {
        var self = this, args = arguments;
        WebSocket._addTask(function () {
            io.Transport.websocket.prototype.send.apply(self, args);
        });
        return this;
    };

    Flashsocket.check = function () {
        if (typeof WebSocket == 'undefined' || !('__addTask' in WebSocket))
            return false;
        if (io.util.opera)
            return false;
        // opera专用
        if ('navigator' in window && 'plugins' in navigator && navigator.plugins['Shockwave Flash']) {
            return !!navigator.plugins['Shockwave Flash'].description;
        }
        if ('ActiveXObject' in window) {
            try {
                return !!new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version');
            } catch (e) {
            }
        }
        return false;
    };

    Flashsocket.xdomainCheck = function () {
        return true;
    };
})();
//合并
(function () {
    var Socket = io.Socket = function (host, options) {
        this.host = host || document.domain;
        this.options = {
            secure: false,
            document: document,
            port: document.location.port || 80,
            resource: 'Rongcloud_WebSocket.lib',
            transports: ['websocket', 'flashsocket'],
            connectTimeout: 5000,
            tryTransportsOnConnectTimeout: true,
            remembersTransport: true
        };
        io.util.merge(this.options, options);
        this.connected = false;
        this.connecting = false;
        this._events = {};
        this.transport = this.getTransport();
        if (!this.transport && 'console' in window) {
            console.error('消息传递不可用');
        }
    };

    Socket.prototype.getTransport = function (override) {
        var transports = override || this.options.transports, match;
        if (this.options.remembersTransport && !override) {
            match = this.options.document.cookie.match('(?:^|;)\\s*Rongcloud_WebSocket.lib=([^;]*)');
            if (match) {
                this._rememberedTransport = true;
                transports = [decodeURIComponent(match[1])];
            }
        }
        for (var i = 0, transport; transport = transports[i]; i++) {
            if (io.Transport[transport] && io.Transport[transport].check() && (!this._isXDomain() || io.Transport[transport].xdomainCheck())) {
                return new io.Transport[transport](this, {});
            }
        }
        return null;
    };

    Socket.prototype.connect = function () {
        if (this.transport && !this.connected) {
            if (this.connecting)
                this.disconnect();
            this.connecting = true;
            this.transport.connect();
            if (this.options.connectTimeout) {
                var self = this;
                setTimeout(function () {
                    if (!self.connected) {
                        self.disconnect();
                        if (self.options.tryTransportsOnConnectTimeout && !self._rememberedTransport) {
                            var remainingTransports = [], transports = self.options.transports;
                            for (var i = 0, transport; transport = transports[i]; i++) {
                                if (transport != self.transport.type)
                                    remainingTransports.push(transport);
                            }
                            if (remainingTransports.length) {
                                self.transport = self.getTransport(remainingTransports);
                                self.connect();
                            }
                        }
                    }
                }, this.options.connectTimeout);
            }
        }
        return this;
    };

    Socket.prototype.send = function (data) {
        if (!this.transport || !this.connected)
            return this._queue(data);
        this.transport.send(data);
        return this;
    };
    Socket.prototype.disconnect = function () {
        this.transport.disconnect();
        return this;
    };
    Socket.prototype.fire = function (name, args) {
        if (name in this._events) {
            for (var i = 0, ii = this._events[name].length; i < ii; i++) {
                this._events[name][i].apply(this, args === undefined ? [] : args);
            }
        }
        return this;
    };
    Socket.prototype.removeEvent = function (name, fn) {
        if (name in this._events) {
            for (var a = 0, l = this._events[name].length; a < l; a++) {
                if (this._events[name][a] == fn)
                    this._events[name].splice(a, 1);
            }
        }
        return this;
    };
    Socket.prototype._queue = function (message) {
        if (!('_queueStack' in this))
            this._queueStack = [];
        this._queueStack.push(message);
        return this;
    };
    Socket.prototype._doQueue = function () {
        if (!('_queueStack' in this) || !this._queueStack.length)
            return this;
        this.transport.send(this._queueStack);
        this._queueStack = [];
        return this;
    };
    Socket.prototype._isXDomain = function () {
        return this.host !== document.domain;
    };
    Socket.prototype._onConnect = function () {
        this.connected = true;
        this.connecting = false;
        this._doQueue();
        if (this.options.remembersTransport) {
            this.options.document.cookie = 'Rongcloud_WebSocket.lib=' + encodeURIComponent(this.transport.type);

        }
        this.fire('connect');
    };
    Socket.prototype._onMessage = function (data) {
        this.fire('message', [data]);
    };
    Socket.prototype._onDisconnect = function () {
        var wasConnected = this.connected;
        this.connected = false;
        this.connecting = false;
        this._queueStack = [];
        if (wasConnected) {
            this.fire('disconnect');
        }
    };

    Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;

})();


//swfobject.js   往下皆为flash websocket解决方案
var swfobject = function () {
    var D = "undefined", r = "object", S = "Shockwave Flash", W = "ShockwaveFlash.ShockwaveFlash", q = "application/x-shockwave-flash", R = "SWFObjectExprInst", x = "onreadystatechange", O = window, j = document, t = navigator, T = false, U = [h], o = [], N = [], I = [], l, Q, E, B, J = false, a = false, n, G, m = true, M = function () {
        var aa = typeof j.getElementById != D && typeof j.getElementsByTagName != D && typeof j.createElement != D, ah = t.userAgent.toLowerCase(), Y = t.platform.toLowerCase(), ae = Y ? /win/.test(Y) : /win/.test(ah), ac = Y ? /mac/.test(Y) : /mac/.test(ah), af = /webkit/.test(ah) ? parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/, "$1")) : false, X = !+"\v1", ag = [0, 0, 0], ab = null;
        if (typeof t.plugins != D && typeof t.plugins[S] == r) {
            ab = t.plugins[S].description;
            if (ab && !( typeof t.mimeTypes != D && t.mimeTypes[q] && !t.mimeTypes[q].enabledPlugin)) {
                T = true;
                X = false;
                ab = ab.replace(/^.*\s+(\S+\s+\S+$)/, "$1");
                ag[0] = parseInt(ab.replace(/^(.*)\..*$/, "$1"), 10);
                ag[1] = parseInt(ab.replace(/^.*\.(.*)\s.*$/, "$1"), 10);
                ag[2] = /[a-zA-Z]/.test(ab) ? parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/, "$1"), 10) : 0
            }
        } else {
            if (typeof O.ActiveXObject != D) {
                try {
                    var ad = new ActiveXObject(W);
                    if (ad) {
                        ab = ad.GetVariable("$version");
                        if (ab) {
                            X = true;
                            ab = ab.split(" ")[1].split(",");
                            ag = [parseInt(ab[0], 10), parseInt(ab[1], 10), parseInt(ab[2], 10)]
                        }
                    }
                } catch (Z) {
                }
            }
        }
        return {
            w3: aa,
            pv: ag,
            wk: af,
            ie: X,
            win: ae,
            mac: ac
        };
    }(), k = function () {
        if (!M.w3) {
            return
        }
        if (( typeof j.readyState != D && j.readyState == "complete") || ( typeof j.readyState == D && (j.getElementsByTagName("body")[0] || j.body))) {
            f()
        }
        if (!J) {
            if (typeof j.addEventListener != D) {
                j.addEventListener("DOMContentLoaded", f, false)
            }
            if (M.ie && M.win) {
                j.attachEvent(x, function () {
                    if (j.readyState == "complete") {
                        j.detachEvent(x, arguments.callee);
                        f()
                    }
                });
                if (O == top) {
                    (function () {
                        if (J) {
                            return
                        }
                        try {
                            j.documentElement.doScroll("left")
                        } catch (X) {
                            setTimeout(arguments.callee, 0);
                            return
                        }
                        f()
                    })();
                }
            }
            if (M.wk) {
                (function () {
                    if (J) {
                        return
                    }
                    if (!/loaded|complete/.test(j.readyState)) {
                        setTimeout(arguments.callee, 0);
                        return
                    }
                    f()
                })();
            }
            s(f)
        }
    }();

    function f() {
        if (J) {
            return
        }
        try {
            var Z = j.getElementsByTagName("body")[0].appendChild(C("span"));
            Z.parentNode.removeChild(Z)
        } catch (aa) {
            return
        }
        J = true;
        var X = U.length;
        for (var Y = 0; Y < X; Y++) {
            U[Y]()
        }
    }

    function K(X) {
        if (J) {
            X()
        } else {
            U[U.length] = X
        }
    }

    function s(Y) {
        if (typeof O.addEventListener != D) {
            O.addEventListener("load", Y, false)
        } else {
            if (typeof j.addEventListener != D) {
                j.addEventListener("load", Y, false)
            } else {
                if (typeof O.attachEvent != D) {
                    i(O, "onload", Y)
                } else {
                    if (typeof O.onload == "function") {
                        var X = O.onload;
                        O.onload = function () {
                            X();
                            Y()
                        };
                    } else {
                        O.onload = Y
                    }
                }
            }
        }
    }

    function h() {
        if (T) {
            V()
        } else {
            H()
        }
    }

    function V() {
        var X = j.getElementsByTagName("body")[0];
        var aa = C(r);
        aa.setAttribute("type", q);
        var Z = X.appendChild(aa);
        if (Z) {
            var Y = 0;
            (function () {
                if (typeof Z.GetVariable != D) {
                    var ab = Z.GetVariable("$version");
                    if (ab) {
                        ab = ab.split(" ")[1].split(",");
                        M.pv = [parseInt(ab[0], 10), parseInt(ab[1], 10), parseInt(ab[2], 10)]
                    }
                } else {
                    if (Y < 10) {
                        Y++;
                        setTimeout(arguments.callee, 10);
                        return
                    }
                }
                X.removeChild(aa);
                Z = null;
                H()
            })();
        } else {
            H()
        }
    }

    function H() {
        var ag = o.length;
        if (ag > 0) {
            for (var af = 0; af < ag; af++) {
                var Y = o[af].id;
                var ab = o[af].callbackFn;
                var aa = {
                    success: false,
                    id: Y
                };
                if (M.pv[0] > 0) {
                    var ae = c(Y);
                    if (ae) {
                        if (F(o[af].swfVersion) && !(M.wk && M.wk < 312)) {
                            w(Y, true);
                            if (ab) {
                                aa.success = true;
                                aa.ref = z(Y);
                                ab(aa)
                            }
                        } else {
                            if (o[af].expressInstall && A()) {
                                var ai = {};
                                ai.data = o[af].expressInstall;
                                ai.width = ae.getAttribute("width") || "0";
                                ai.height = ae.getAttribute("height") || "0";
                                if (ae.getAttribute("class")) {
                                    ai.styleclass = ae.getAttribute("class")
                                }
                                if (ae.getAttribute("align")) {
                                    ai.align = ae.getAttribute("align")
                                }
                                var ah = {};
                                var X = ae.getElementsByTagName("param");
                                var ac = X.length;
                                for (var ad = 0; ad < ac; ad++) {
                                    if (X[ad].getAttribute("name").toLowerCase() != "movie") {
                                        ah[X[ad].getAttribute("name")] = X[ad].getAttribute("value")
                                    }
                                }
                                P(ai, ah, Y, ab)
                            } else {
                                p(ae);
                                if (ab) {
                                    ab(aa)
                                }
                            }
                        }
                    }
                } else {
                    w(Y, true);
                    if (ab) {
                        var Z = z(Y);
                        if (Z && typeof Z.SetVariable != D) {
                            aa.success = true;
                            aa.ref = Z
                        }
                        ab(aa)
                    }
                }
            }
        }
    }

    function z(aa) {
        var X = null;
        var Y = c(aa);
        if (Y && Y.nodeName == "OBJECT") {
            if (typeof Y.SetVariable != D) {
                X = Y
            } else {
                var Z = Y.getElementsByTagName(r)[0];
                if (Z) {
                    X = Z
                }
            }
        }
        return X
    }

    function A() {
        return !a && F("6.0.65") && (M.win || M.mac) && !(M.wk && M.wk < 312)
    }

    function P(aa, ab, X, Z) {
        a = true;
        E = Z || null;
        B = {
            success: false,
            id: X
        };
        var ae = c(X);
        if (ae) {
            if (ae.nodeName == "OBJECT") {
                l = g(ae);
                Q = null
            } else {
                l = ae;
                Q = X
            }
            aa.id = R;
            if (typeof aa.width == D || (!/%$/.test(aa.width) && parseInt(aa.width, 10) < 310)) {
                aa.width = "310"
            }
            if (typeof aa.height == D || (!/%$/.test(aa.height) && parseInt(aa.height, 10) < 137)) {
                aa.height = "137"
            }
            j.title = j.title.slice(0, 47) + " - Flash Player Installation";
            var ad = M.ie && M.win ? "ActiveX" : "PlugIn", ac = "MMredirectURL=" + O.location.toString().replace(/&/g, "%26") + "&MMplayerType=" + ad + "&MMdoctitle=" + j.title;
            if (typeof ab.flashvars != D) {
                ab.flashvars += "&" + ac
            } else {
                ab.flashvars = ac
            }
            if (M.ie && M.win && ae.readyState != 4) {
                var Y = C("div");
                X += "SWFObjectNew";
                Y.setAttribute("id", X);
                ae.parentNode.insertBefore(Y, ae);
                ae.style.display = "none";
                (function () {
                    if (ae.readyState == 4) {
                        ae.parentNode.removeChild(ae)
                    } else {
                        setTimeout(arguments.callee, 10)
                    }
                })();
            }
            u(aa, ab, X)
        }
    }

    function p(Y) {
        if (M.ie && M.win && Y.readyState != 4) {
            var X = C("div");
            Y.parentNode.insertBefore(X, Y);
            X.parentNode.replaceChild(g(Y), X);
            Y.style.display = "none";
            (function () {
                if (Y.readyState == 4) {
                    Y.parentNode.removeChild(Y)
                } else {
                    setTimeout(arguments.callee, 10)
                }
            })();
        } else {
            Y.parentNode.replaceChild(g(Y), Y)
        }
    }

    function g(ab) {
        var aa = C("div");
        if (M.win && M.ie) {
            aa.innerHTML = ab.innerHTML
        } else {
            var Y = ab.getElementsByTagName(r)[0];
            if (Y) {
                var ad = Y.childNodes;
                if (ad) {
                    var X = ad.length;
                    for (var Z = 0; Z < X; Z++) {
                        if (!(ad[Z].nodeType == 1 && ad[Z].nodeName == "PARAM") && !(ad[Z].nodeType == 8)) {
                            aa.appendChild(ad[Z].cloneNode(true))
                        }
                    }
                }
            }
        }
        return aa
    }

    function u(ai, ag, Y) {
        var X, aa = c(Y);
        if (M.wk && M.wk < 312) {
            return X
        }
        if (aa) {
            if (typeof ai.id == D) {
                ai.id = Y
            }
            if (M.ie && M.win) {
                var ah = "";
                for (var ae in ai) {
                    if (ai[ae] != Object.prototype[ae]) {
                        if (ae.toLowerCase() == "data") {
                            ag.movie = ai[ae]
                        } else {
                            if (ae.toLowerCase() == "styleclass") {
                                ah += ' class="' + ai[ae] + '"'
                            } else {
                                if (ae.toLowerCase() != "classid") {
                                    ah += " " + ae + '="' + ai[ae] + '"'
                                }
                            }
                        }
                    }
                }
                var af = "";
                for (var ad in ag) {
                    if (ag[ad] != Object.prototype[ad]) {
                        af += '<param name="' + ad + '" value="' + ag[ad] + '" />'
                    }
                }
                aa.outerHTML = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"' + ah + ">" + af + "</object>";
                N[N.length] = ai.id;
                X = c(ai.id)
            } else {
                var Z = C(r);
                Z.setAttribute("type", q);
                for (var ac in ai) {
                    if (ai[ac] != Object.prototype[ac]) {
                        if (ac.toLowerCase() == "styleclass") {
                            Z.setAttribute("class", ai[ac])
                        } else {
                            if (ac.toLowerCase() != "classid") {
                                Z.setAttribute(ac, ai[ac])
                            }
                        }
                    }
                }
                for (var ab in ag) {
                    if (ag[ab] != Object.prototype[ab] && ab.toLowerCase() != "movie") {
                        e(Z, ab, ag[ab])
                    }
                }
                aa.parentNode.replaceChild(Z, aa);
                X = Z
            }
        }
        return X
    }

    function e(Z, X, Y) {
        var aa = C("param");
        aa.setAttribute("name", X);
        aa.setAttribute("value", Y);
        Z.appendChild(aa);
    }

    function y(Y) {
        var X = c(Y);
        if (X && X.nodeName == "OBJECT") {
            if (M.ie && M.win) {
                X.style.display = "none";
                (function () {
                    if (X.readyState == 4) {
                        b(Y);
                    } else {
                        setTimeout(arguments.callee, 10);
                    }
                })();
            } else {
                X.parentNode.removeChild(X);
            }
        }
    }

    function b(Z) {
        var Y = c(Z);
        if (Y) {
            for (var X in Y) {
                if (typeof Y[X] == "function") {
                    Y[X] = null;
                }
            }
            Y.parentNode.removeChild(Y);
        }
    }

    function c(Z) {
        var X = null;
        try {
            X = j.getElementById(Z);
        } catch (Y) {
        }
        return X
    }

    function C(X) {
        return j.createElement(X);
    }

    function i(Z, X, Y) {
        Z.attachEvent(X, Y);
        I[I.length] = [Z, X, Y];
    }

    function F(Z) {
        var Y = M.pv, X = Z.split(".");
        X[0] = parseInt(X[0], 10);
        X[1] = parseInt(X[1], 10) || 0;
        X[2] = parseInt(X[2], 10) || 0;
        return (Y[0] > X[0] || (Y[0] == X[0] && Y[1] > X[1]) || (Y[0] == X[0] && Y[1] == X[1] && Y[2] >= X[2])) ? true : false;
    }

    function v(ac, Y, ad, ab) {
        if (M.ie && M.mac) {
            return;
        }
        var aa = j.getElementsByTagName("head")[0];
        if (!aa) {
            return;
        }
        var X = (ad && typeof ad == "string") ? ad : "screen";
        if (ab) {
            n = null;
            G = null;
        }
        if (!n || G != X) {
            var Z = C("style");
            Z.setAttribute("type", "text/css");
            Z.setAttribute("media", X);
            n = aa.appendChild(Z);
            if (M.ie && M.win && typeof j.styleSheets != D && j.styleSheets.length > 0) {
                n = j.styleSheets[j.styleSheets.length - 1];
            }
            G = X;
        }
        if (M.ie && M.win) {
            if (n && typeof n.addRule == r) {
                n.addRule(ac, Y);
            }
        } else {
            if (n && typeof j.createTextNode != D) {
                n.appendChild(j.createTextNode(ac + " {" + Y + "}"));
            }
        }
    }

    function w(Z, X) {
        if (!m) {
            return;
        }
        var Y = X ? "visible" : "hidden";
        if (J && c(Z)) {
            c(Z).style.visibility = Y;
        } else {
            v("#" + Z, "visibility:" + Y);
        }
    }

    function L(Y) {
        var Z = /[\\\"<>\.;]/;
        var X = Z.exec(Y) != null;
        return X && typeof encodeURIComponent != D ? encodeURIComponent(Y) : Y;
    }

    var d = function () {
        if (M.ie && M.win) {
            window.attachEvent("onunload", function () {
                var ac = I.length;
                for (var ab = 0; ab < ac; ab++) {
                    I[ab][0].detachEvent(I[ab][1], I[ab][2]);
                }
                var Z = N.length;
                for (var aa = 0; aa < Z; aa++) {
                    y(N[aa]);
                }
                for (var Y in M) {
                    M[Y] = null;
                }
                M = null;
                for (var X in swfobject) {
                    swfobject[X] = null;
                }
                swfobject = null;
            });
        }
    }();
    return {
        registerObject: function (ab, X, aa, Z) {
            if (M.w3 && ab && X) {
                var Y = {};
                Y.id = ab;
                Y.swfVersion = X;
                Y.expressInstall = aa;
                Y.callbackFn = Z;
                o[o.length] = Y;
                w(ab, false);
            } else {
                if (Z) {
                    Z({
                        success: false,
                        id: ab
                    });
                }
            }
        },
        getObjectById: function (X) {
            if (M.w3) {
                return z(X)
            }
        },
        embedSWF: function (ab, ah, ae, ag, Y, aa, Z, ad, af, ac) {
            var X = {
                success: false,
                id: ah
            };
            if (M.w3 && !(M.wk && M.wk < 312) && ab && ah && ae && ag && Y) {
                w(ah, false);
                K(function () {
                    ae += "";
                    ag += "";
                    var aj = {};
                    if (af && typeof af === r) {
                        for (var al in af) {
                            aj[al] = af[al];
                        }
                    }
                    aj.data = ab;
                    aj.width = ae;
                    aj.height = ag;
                    var am = {};
                    if (ad && typeof ad === r) {
                        for (var ak in ad) {
                            am[ak] = ad[ak];
                        }
                    }
                    if (Z && typeof Z === r) {
                        for (var ai in Z) {
                            if (typeof am.flashvars != D) {
                                am.flashvars += "&" + ai + "=" + Z[ai];
                            } else {
                                am.flashvars = ai + "=" + Z[ai];
                            }
                        }
                    }
                    if (F(Y)) {
                        var an = u(aj, am, ah);
                        if (aj.id == ah) {
                            w(ah, true);
                        }
                        X.success = true;
                        X.ref = an;
                    } else {
                        if (aa && A()) {
                            aj.data = aa;
                            P(aj, am, ah, ac);
                            return;
                        } else {
                            w(ah, true);
                        }
                    }
                    if (ac) {
                        ac(X);
                    }
                });
            } else {
                if (ac) {
                    ac(X);
                }
            }
        },
        switchOffAutoHideShow: function () {
            m = false;
        },
        ua: M,
        getFlashPlayerVersion: function () {
            return {
                major: M.pv[0],
                minor: M.pv[1],
                release: M.pv[2]
            };
        },
        hasFlashPlayerVersion: F,
        createSWF: function (Z, Y, X) {
            if (M.w3) {
                return u(Z, Y, X);
            } else {
                return undefined;
            }
        },
        showExpressInstall: function (Z, aa, X, Y) {
            if (M.w3 && A()) {
                P(Z, aa, X, Y);
            }
        },
        removeSWF: function (X) {
            if (M.w3) {
                y(X);
            }
        },
        createCSS: function (aa, Z, Y, X) {
            if (M.w3) {
                v(aa, Z, Y, X);
            }
        },
        addDomLoadEvent: K,
        addLoadEvent: s,
        getQueryParamValue: function (aa) {
            var Z = j.location.search || j.location.hash;
            if (Z) {
                if (/\?/.test(Z)) {
                    Z = Z.split("?")[1];
                }
                if (aa == null) {
                    return L(Z);
                }
                var Y = Z.split("&");
                for (var X = 0; X < Y.length; X++) {
                    if (Y[X].substring(0, Y[X].indexOf("=")) == aa) {
                        return L(Y[X].substring((Y[X].indexOf("=") + 1)));
                    }
                }
            }
            return "";
        },
        expressInstallCallback: function () {
            if (a) {
                var X = c(R);
                if (X && l) {
                    X.parentNode.replaceChild(l, X);
                    if (Q) {
                        w(Q, true);
                        if (M.ie && M.win) {
                            l.style.display = "block";
                        }
                    }
                    if (E) {
                        E(B);
                    }
                }
                a = false;
            }
        }
    };
}();

//web_socket.js
(function () {

    if (window.WebSocket)
        return;

    var console = window.console;
    if (!console)
        console = {
            log: function () {
            },
            error: function () {
            }
        };

    if (!swfobject.hasFlashPlayerVersion("9.0.0")) {
        console.error("Flash Player is not installed.");
        return;
    }
    if (location.protocol == "file:") {
        console.error("WARNING: web-socket-js doesn't work in file:///... URL " + "unless you set Flash Security Settings properly. " + "Open the page via Web server i.e. http://...");
    }

    WebSocket = function (url, protocol, proxyHost, proxyPort, headers) {
        var self = this;
        self.readyState = WebSocket.CONNECTING;
        self.bufferedAmount = 0;
        setTimeout(function () {
            WebSocket.__addTask(function () {
                self.__createFlash(url, protocol, proxyHost, proxyPort, headers);
            });
        }, 1);
    };

    WebSocket.prototype.__createFlash = function (url, protocol, proxyHost, proxyPort, headers) {
        var self = this;
        self.__flash = WebSocket.__flash.create(url, protocol, proxyHost || null, proxyPort || 0, headers || null);

        self.__flash.addEventListener("open", function (fe) {
            try {
                self.readyState = self.__flash.getReadyState();
                if (self.__timer)
                    clearInterval(self.__timer);
                if (window.opera) {
                    // Workaround for weird behavior of Opera which sometimes drops events.
                    self.__timer = setInterval(function () {
                        self.__handleMessages();
                    }, 500);
                }
                if (self.onopen)
                    self.onopen();
            } catch (e) {
                console.error(e.toString());
            }
        });

        self.__flash.addEventListener("close", function (fe) {
            try {
                self.readyState = self.__flash.getReadyState();
                if (self.__timer)
                    clearInterval(self.__timer);
                if (self.onclose)
                    self.onclose();
            } catch (e) {
                console.error(e.toString());
            }
        });

        self.__flash.addEventListener("message", function () {
            try {
                self.__handleMessages();
            } catch (e) {
                console.error(e.toString());
            }
        });

        self.__flash.addEventListener("error", function (fe) {
            try {
                if (self.__timer)
                    clearInterval(self.__timer);
                if (self.onerror)
                    self.onerror();
            } catch (e) {
                console.error(e.toString());
            }
        });

        self.__flash.addEventListener("stateChange", function (fe) {
            try {
                self.readyState = self.__flash.getReadyState();
                self.bufferedAmount = fe.getBufferedAmount();
            } catch (e) {
                console.error(e.toString());
            }
        });
    };

    WebSocket.prototype.send = function (data) {
        if (this.__flash) {
            this.readyState = this.__flash.getReadyState();
        }
        if (!this.__flash || this.readyState == WebSocket.CONNECTING) {
            throw "INVALID_STATE_ERR: Web Socket connection has not been established";
        }
        var result = this.__flash.send(encodeURIComponent(data));
        if (result < 0) {// success
            return true;
        } else {
            this.bufferedAmount = result;
            return false;
        }
    };

    WebSocket.prototype.close = function () {
        var self = this;
        if (!self.__flash)
            return;
        self.readyState = self.__flash.getReadyState();
        if (self.readyState == WebSocket.CLOSED || self.readyState == WebSocket.CLOSING)
            return;
        self.__flash.close();
        self.readyState = WebSocket.CLOSED;
        if (self.__timer)
            clearInterval(self.__timer);
        if (self.onclose) {
            setTimeout(self.onclose, 1);
        }
    };
    WebSocket.prototype.addEventListener = function (type, listener, useCapture) {
        if (!('__events' in this)) {
            this.__events = {};
        }
        if (!( type in this.__events)) {
            this.__events[type] = [];
            if ('function' == typeof this['on' + type]) {
                this.__events[type].defaultHandler = this['on' + type];
                this['on' + type] = this.__createEventHandler(this, type);
            }
        }
        this.__events[type].push(listener);
    };
    WebSocket.prototype.removeEventListener = function (type, listener, useCapture) {
        if (!('__events' in this)) {
            this.__events = {};
        }
        if (!( type in this.__events))
            return;
        for (var i = this.__events.length; i > -1; --i) {
            if (listener === this.__events[type][i]) {
                this.__events[type].splice(i, 1);
                break;
            }
        }
    };
    WebSocket.prototype.dispatchEvent = function (event) {
        if (!('__events' in this))
            throw 'UNSPECIFIED_EVENT_TYPE_ERR';
        if (!(event.type in this.__events))
            throw 'UNSPECIFIED_EVENT_TYPE_ERR';

        for (var i = 0, l = this.__events[event.type].length; i < l; ++i) {
            this.__events[event.type][i](event);
            if (event.cancelBubble)
                break;
        }

        if (false !== event.returnValue && 'function' == typeof this.__events[event.type].defaultHandler) {
            this.__events[event.type].defaultHandler(event);
        }
    };

    WebSocket.prototype.__handleMessages = function () {
        var arr = this.__flash.readSocketData();
        for (var i = 0; i < arr.length; i++) {
            var data = decodeURIComponent(arr[i]);
            try {
                if (this.onmessage) {
                    var e;
                    if (window.MessageEvent) {
                        e = document.createEvent("MessageEvent");
                        e.initMessageEvent("message", false, false, data, null, null, window, null);
                    } else {// IE
                        e = {
                            data: data
                        };
                    }
                    this.onmessage(e);
                }
            } catch (e) {
                console.error(e.toString());
            }
        }
    };
    WebSocket.prototype.__createEventHandler = function (object, type) {
        return function (data) {
            var event = new WebSocketEvent();
            event.initEvent(type, true, true);
            event.target = event.currentTarget = object;
            for (var key in data) {
                event[key] = data[key];
            }
            object.dispatchEvent(event, arguments);
        };
    };
    function WebSocketEvent() {
    }

    WebSocketEvent.prototype.cancelable = true;
    WebSocketEvent.prototype.cancelBubble = false;
    WebSocketEvent.prototype.preventDefault = function () {
        if (this.cancelable) {
            this.returnValue = false;
        }
    };
    WebSocketEvent.prototype.stopPropagation = function () {
        this.cancelBubble = true;
    };
    WebSocketEvent.prototype.initEvent = function (eventTypeArg, canBubbleArg, cancelableArg) {
        this.type = eventTypeArg;
        this.cancelable = cancelableArg;
        this.timeStamp = new Date();
    };

    WebSocket.CONNECTING = 0;
    WebSocket.OPEN = 1;
    WebSocket.CLOSING = 2;
    WebSocket.CLOSED = 3;

    WebSocket.__tasks = [];

    WebSocket.__initialize = function () {
        if (WebSocket.__swfLocation) {
            // For backword compatibility.
            window.WEB_SOCKET_SWF_LOCATION = WebSocket.__swfLocation;
        }
        if (!window.WEB_SOCKET_SWF_LOCATION) {
            console.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
            return;
        }
        var container = document.createElement("div");
        container.id = "webSocketContainer";
        container.style.position = "absolute";
        if (WebSocket.__isFlashLite()) {
            container.style.left = "0px";
            container.style.top = "0px";
        } else {
            container.style.left = "-100px";
            container.style.top = "-100px";
        }
        var holder = document.createElement("div");
        holder.id = "webSocketFlash";
        container.appendChild(holder);
        document.body.appendChild(container);
        swfobject.embedSWF(WEB_SOCKET_SWF_LOCATION, "webSocketFlash", "1"/* width */, "1"/* height */, "9.0.0"/* SWF version */, null, {
            bridgeName: "webSocket"
        }, {
            hasPriority: true,
            allowScriptAccess: "always"
        }, null, function (e) {
            if (!e.success)
                console.error("[WebSocket] swfobject.embedSWF failed");
        });
        FABridge.addInitializationCallback("webSocket", function () {
            try {
                //console.log("[WebSocket] FABridge initializad");
                WebSocket.__flash = FABridge.webSocket.root();
                WebSocket.__flash.setCallerUrl(location.href);
                WebSocket.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
                for (var i = 0; i < WebSocket.__tasks.length; ++i) {
                    WebSocket.__tasks[i]();
                }
                WebSocket.__tasks = [];
            } catch (e) {
                console.error("[WebSocket] " + e.toString());
            }
        });
    };

    WebSocket.__addTask = function (task) {
        if (WebSocket.__flash) {
            task();
        } else {
            WebSocket.__tasks.push(task);
        }
    };

    WebSocket.__isFlashLite = function () {
        if (!window.navigator || !window.navigator.mimeTypes)
            return false;
        var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
        if (!mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename)
            return false;
        return mimeType.enabledPlugin.filename.match(/flashlite/i) ? true : false;
    };

    window.webSocketLog = function (message) {
        console.log(decodeURIComponent(message));
    };

    window.webSocketError = function (message) {
        console.error(decodeURIComponent(message));
    };

    if (!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION) {
        if (window.addEventListener) {
            window.addEventListener("load", WebSocket.__initialize, false);
        } else {
            window.attachEvent("onload", WebSocket.__initialize);
        }
    }

})();

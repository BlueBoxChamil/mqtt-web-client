(function(global, factory) {
	"use strict";
	var m = factory(global);
	if (typeof module === "object" && module != null && module.exports) {
		module.exports = m
	} else if (typeof define === "function" && define.amd) {
		define(function() {
			return m
		})
	} else {
		global.m = m
	}
})(typeof window !== "undefined" ? window : {}, function(global, undefined) {
	"use strict";
	m.version = function() {
		return "v0.2.3"
	};
	var hasOwn = {}.hasOwnProperty;
	var type = {}.toString;

	function isFunction(object) {
		return typeof object === "function"
	}

	function isObject(object) {
		return type.call(object) === "[object Object]"
	}

	function isString(object) {
		return type.call(object) === "[object String]"
	}
	var isArray = Array.isArray || function(object) {
			return type.call(object) === "[object Array]"
		};

	function noop() {}
	var voidElements = {
		AREA: 1,
		BASE: 1,
		BR: 1,
		COL: 1,
		COMMAND: 1,
		EMBED: 1,
		HR: 1,
		IMG: 1,
		INPUT: 1,
		KEYGEN: 1,
		LINK: 1,
		META: 1,
		PARAM: 1,
		SOURCE: 1,
		TRACK: 1,
		WBR: 1
	};
	var $document, $location, $requestAnimationFrame, $cancelAnimationFrame;

	function initialize(mock) {
		$document = mock.document;
		$location = mock.location;
		$cancelAnimationFrame = mock.cancelAnimationFrame || mock.clearTimeout;
		$requestAnimationFrame = mock.requestAnimationFrame || mock.setTimeout
	}
	m.deps = function(mock) {
		initialize(global = mock || window);
		return global
	};
	m.deps(global);

	function parseTagAttrs(cell, tag) {
		var classes = [];
		var parser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[.+?\])/g;
		var match;
		while (match = parser.exec(tag)) {
			if (match[1] === "" && match[2]) {
				cell.tag = match[2]
			} else if (match[1] === "#") {
				cell.attrs.id = match[2]
			} else if (match[1] === ".") {
				classes.push(match[2])
			} else if (match[3][0] === "[") {
				var pair = /\[(.+?)(?:=("|'|)(.*?)\2)?\]/.exec(match[3]);
				cell.attrs[pair[1]] = pair[3] || (pair[2] ? "" : true)
			}
		}
		return classes
	}

	function getVirtualChildren(args, hasAttrs) {
		var children = hasAttrs ? args.slice(1) : args;
		if (children.length === 1 && isArray(children[0])) {
			return children[0]
		} else {
			return children
		}
	}

	function assignAttrs(target, attrs, classes) {
		var classAttr = "class" in attrs ? "class" : "className";
		for (var attrName in attrs) {
			if (hasOwn.call(attrs, attrName)) {
				if (attrName === classAttr && attrs[attrName] != null && attrs[attrName] !== "") {
					classes.push(attrs[attrName]);
					target[attrName] = ""
				} else {
					target[attrName] = attrs[attrName]
				}
			}
		}
		if (classes.length) target[classAttr] = classes.join(" ")
	}

	function m(tag, pairs) {
		var args = [].slice.call(arguments, 1);
		if (isObject(tag)) return parameterize(tag, args);
		if (!isString(tag)) {
			throw new Error("selector in m(selector, attrs, children) should " + "be a string")
		}
		var hasAttrs = pairs != null && isObject(pairs) && !("tag" in pairs || "view" in pairs || "subtree" in pairs);
		var attrs = hasAttrs ? pairs : {};
		var cell = {
			tag: "div",
			attrs: {},
			children: getVirtualChildren(args, hasAttrs)
		};
		assignAttrs(cell.attrs, attrs, parseTagAttrs(cell, tag));
		return cell
	}

	function forEach(list, f) {
		for (var i = 0; i < list.length && !f(list[i], i++);) {}
	}

	function forKeys(list, f) {
		forEach(list, function(attrs, i) {
			return (attrs = attrs && attrs.attrs) && attrs.key != null && f(attrs, i)
		})
	}

	function dataToString(data) {
		try {
			if (data != null && data.toString() != null) return data
		} catch (e) {}
		return ""
	}

	function injectTextNode(parentElement, first, index, data) {
		try {
			insertNode(parentElement, first, index);
			first.nodeValue = data
		} catch (e) {}
	}

	function flatten(list) {
		for (var i = 0; i < list.length; i++) {
			if (isArray(list[i])) {
				list = list.concat.apply([], list);
				i--
			}
		}
		return list
	}

	function insertNode(parentElement, node, index) {
		parentElement.insertBefore(node, parentElement.childNodes[index] || null)
	}
	var DELETION = 1;
	var INSERTION = 2;
	var MOVE = 3;

	function handleKeysDiffer(data, existing, cached, parentElement) {
		forKeys(data, function(key, i) {
			existing[key = key.key] = existing[key] ? {
				action: MOVE,
				index: i,
				from: existing[key].index,
				element: cached.nodes[existing[key].index] || $document.createElement("div")
			} : {
				action: INSERTION,
				index: i
			}
		});
		var actions = [];
		for (var prop in existing)
			if (hasOwn.call(existing, prop)) {
				actions.push(existing[prop])
			}
		var changes = actions.sort(sortChanges);
		var newCached = new Array(cached.length);
		newCached.nodes = cached.nodes.slice();
		forEach(changes, function(change) {
			var index = change.index;
			if (change.action === DELETION) {
				clear(cached[index].nodes, cached[index]);
				newCached.splice(index, 1)
			}
			if (change.action === INSERTION) {
				var dummy = $document.createElement("div");
				dummy.key = data[index].attrs.key;
				insertNode(parentElement, dummy, index);
				newCached.splice(index, 0, {
					attrs: {
						key: data[index].attrs.key
					},
					nodes: [dummy]
				});
				newCached.nodes[index] = dummy
			}
			if (change.action === MOVE) {
				var changeElement = change.element;
				var maybeChanged = parentElement.childNodes[index];
				if (maybeChanged !== changeElement && changeElement !== null) {
					parentElement.insertBefore(changeElement, maybeChanged || null)
				}
				newCached[index] = cached[change.from];
				newCached.nodes[index] = changeElement
			}
		});
		return newCached
	}

	function diffKeys(data, cached, existing, parentElement) {
		var keysDiffer = data.length !== cached.length;
		if (!keysDiffer) {
			forKeys(data, function(attrs, i) {
				var cachedCell = cached[i];
				return keysDiffer = cachedCell && cachedCell.attrs && cachedCell.attrs.key !== attrs.key
			})
		}
		if (keysDiffer) {
			return handleKeysDiffer(data, existing, cached, parentElement)
		} else {
			return cached
		}
	}

	function diffArray(data, cached, nodes) {
		forEach(data, function(_, i) {
			if (cached[i] != null) nodes.push.apply(nodes, cached[i].nodes)
		});
		forEach(cached.nodes, function(node, i) {
			if (node.parentNode != null && nodes.indexOf(node) < 0) {
				clear([node], [cached[i]])
			}
		});
		if (data.length < cached.length) cached.length = data.length;
		cached.nodes = nodes
	}

	function buildArrayKeys(data) {
		var guid = 0;
		forKeys(data, function() {
			forEach(data, function(attrs) {
				if ((attrs = attrs && attrs.attrs) && attrs.key == null) {
					attrs.key = "__mithril__" + guid++
				}
			});
			return 1
		})
	}

	function isDifferentEnough(data, cached, dataAttrKeys) {
		if (data.tag !== cached.tag) return true;
		if (dataAttrKeys.sort().join() !== Object.keys(cached.attrs).sort().join()) {
			return true
		}
		if (data.attrs.id !== cached.attrs.id) {
			return true
		}
		if (data.attrs.key !== cached.attrs.key) {
			return true
		}
		if (m.redraw.strategy() === "all") {
			return !cached.configContext || cached.configContext.retain !== true
		}
		if (m.redraw.strategy() === "diff") {
			return cached.configContext && cached.configContext.retain === false
		}
		return false
	}

	function maybeRecreateObject(data, cached, dataAttrKeys) {
		if (isDifferentEnough(data, cached, dataAttrKeys)) {
			if (cached.nodes.length) clear(cached.nodes);
			if (cached.configContext && isFunction(cached.configContext.onunload)) {
				cached.configContext.onunload()
			}
			if (cached.controllers) {
				forEach(cached.controllers, function(controller) {
					if (controller.onunload) controller.onunload({
						preventDefault: noop
					})
				})
			}
		}
	}

	function getObjectNamespace(data, namespace) {
		if (data.attrs.xmlns) return data.attrs.xmlns;
		if (data.tag === "svg") return "http://www.w3.org/2000/svg";
		if (data.tag === "math") return "http://www.w3.org/1998/Math/MathML";
		return namespace
	}
	var pendingRequests = 0;
	m.startComputation = function() {
		pendingRequests++
	};
	m.endComputation = function() {
		if (pendingRequests > 1) {
			pendingRequests--
		} else {
			pendingRequests = 0;
			m.redraw()
		}
	};

	function unloadCachedControllers(cached, views, controllers) {
		if (controllers.length) {
			cached.views = views;
			cached.controllers = controllers;
			forEach(controllers, function(controller) {
				if (controller.onunload && controller.onunload.$old) {
					controller.onunload = controller.onunload.$old
				}
				if (pendingRequests && controller.onunload) {
					var onunload = controller.onunload;
					controller.onunload = noop;
					controller.onunload.$old = onunload
				}
			})
		}
	}

	function scheduleConfigsToBeCalled(configs, data, node, isNew, cached) {
		if (isFunction(data.attrs.config)) {
			var context = cached.configContext = cached.configContext || {};
			configs.push(function() {
				return data.attrs.config.call(data, node, !isNew, context, cached)
			})
		}
	}

	function buildUpdatedNode(cached, data, editable, hasKeys, namespace, views, configs, controllers) {
		var node = cached.nodes[0];
		if (hasKeys) {
			setAttributes(node, data.tag, data.attrs, cached.attrs, namespace)
		}
		cached.children = build(node, data.tag, undefined, undefined, data.children, cached.children, false, 0, data.attrs.contenteditable ? node : editable, namespace, configs);
		cached.nodes.intact = true;
		if (controllers.length) {
			cached.views = views;
			cached.controllers = controllers
		}
		return node
	}

	function handleNonexistentNodes(data, parentElement, index) {
		var nodes;
		if (data.$trusted) {
			nodes = injectHTML(parentElement, index, data)
		} else {
			nodes = [$document.createTextNode(data)];
			if (!(parentElement.nodeName in voidElements)) {
				insertNode(parentElement, nodes[0], index)
			}
		}
		var cached;
		if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
			cached = new data.constructor(data)
		} else {
			cached = data
		}
		cached.nodes = nodes;
		return cached
	}

	function reattachNodes(data, cached, parentElement, editable, index, parentTag) {
		var nodes = cached.nodes;
		if (!editable || editable !== $document.activeElement) {
			if (data.$trusted) {
				clear(nodes, cached);
				nodes = injectHTML(parentElement, index, data)
			} else if (parentTag === "textarea") {
				parentElement.value = data
			} else if (editable) {
				editable.innerHTML = data
			} else {
				if (nodes[0].nodeType === 1 || nodes.length > 1 || nodes[0].nodeValue.trim && !nodes[0].nodeValue.trim()) {
					clear(cached.nodes, cached);
					nodes = [$document.createTextNode(data)]
				}
				injectTextNode(parentElement, nodes[0], index, data)
			}
		}
		cached = new data.constructor(data);
		cached.nodes = nodes;
		return cached
	}

	function handleTextNode(cached, data, index, parentElement, shouldReattach, editable, parentTag) {
		if (!cached.nodes.length) {
			return handleNonexistentNodes(data, parentElement, index)
		} else if (cached.valueOf() !== data.valueOf() || shouldReattach) {
			return reattachNodes(data, cached, parentElement, editable, index, parentTag)
		} else {
			return cached.nodes.intact = true, cached
		}
	}

	function getSubArrayCount(item) {
		if (item.$trusted) {
			var match = item.match(/<[^\/]|\>\s*[^<]/g);
			if (match != null) return match.length
		} else if (isArray(item)) {
			return item.length
		}
		return 1
	}

	function buildArray(data, cached, parentElement, index, parentTag, shouldReattach, editable, namespace, configs) {
		data = flatten(data);
		var nodes = [];
		var intact = cached.length === data.length;
		var subArrayCount = 0;
		var existing = {};
		var shouldMaintainIdentities = false;
		forKeys(cached, function(attrs, i) {
			shouldMaintainIdentities = true;
			existing[cached[i].attrs.key] = {
				action: DELETION,
				index: i
			}
		});
		buildArrayKeys(data);
		if (shouldMaintainIdentities) {
			cached = diffKeys(data, cached, existing, parentElement)
		}
		var cacheCount = 0;
		for (var i = 0, len = data.length; i < len; i++) {
			var item = build(parentElement, parentTag, cached, index, data[i], cached[cacheCount], shouldReattach, index + subArrayCount || subArrayCount, editable, namespace, configs);
			if (item !== undefined) {
				intact = intact && item.nodes.intact;
				subArrayCount += getSubArrayCount(item);
				cached[cacheCount++] = item
			}
		}
		if (!intact) diffArray(data, cached, nodes);
		return cached
	}

	function makeCache(data, cached, index, parentIndex, parentCache) {
		if (cached != null) {
			if (type.call(cached) === type.call(data)) return cached;
			if (parentCache && parentCache.nodes) {
				var offset = index - parentIndex;
				var end = offset + (isArray(data) ? data : cached.nodes).length;
				clear(parentCache.nodes.slice(offset, end), parentCache.slice(offset, end))
			} else if (cached.nodes) {
				clear(cached.nodes, cached)
			}
		}
		cached = new data.constructor;
		if (cached.tag) cached = {};
		cached.nodes = [];
		return cached
	}

	function constructNode(data, namespace) {
		if (data.attrs.is) {
			if (namespace == null) {
				return $document.createElement(data.tag, data.attrs.is)
			} else {
				return $document.createElementNS(namespace, data.tag, data.attrs.is)
			}
		} else if (namespace == null) {
			return $document.createElement(data.tag)
		} else {
			return $document.createElementNS(namespace, data.tag)
		}
	}

	function constructAttrs(data, node, namespace, hasKeys) {
		if (hasKeys) {
			return setAttributes(node, data.tag, data.attrs, {}, namespace)
		} else {
			return data.attrs
		}
	}

	function constructChildren(data, node, cached, editable, namespace, configs) {
		if (data.children != null && data.children.length > 0) {
			return build(node, data.tag, undefined, undefined, data.children, cached.children, true, 0, data.attrs.contenteditable ? node : editable, namespace, configs)
		} else {
			return data.children
		}
	}

	function reconstructCached(data, attrs, children, node, namespace, views, controllers) {
		var cached = {
			tag: data.tag,
			attrs: attrs,
			children: children,
			nodes: [node]
		};
		unloadCachedControllers(cached, views, controllers);
		if (cached.children && !cached.children.nodes) {
			cached.children.nodes = []
		}
		if (data.tag === "select" && "value" in data.attrs) {
			setAttributes(node, data.tag, {
				value: data.attrs.value
			}, {}, namespace)
		}
		return cached
	}

	function getController(views, view, cachedControllers, controller) {
		var controllerIndex;
		if (m.redraw.strategy() === "diff" && views) {
			controllerIndex = views.indexOf(view)
		} else {
			controllerIndex = -1
		} if (controllerIndex > -1) {
			return cachedControllers[controllerIndex]
		} else if (isFunction(controller)) {
			return new controller
		} else {
			return {}
		}
	}
	var unloaders = [];

	function updateLists(views, controllers, view, controller) {
		if (controller.onunload != null && unloaders.map(function(u) {
			return u.handler
		}).indexOf(controller.onunload) < 0) {
			unloaders.push({
				controller: controller,
				handler: controller.onunload
			})
		}
		views.push(view);
		controllers.push(controller)
	}
	var forcing = false;

	function checkView(data, view, cached, cachedControllers, controllers, views) {
		var controller = getController(cached.views, view, cachedControllers, data.controller);
		var key = data && data.attrs && data.attrs.key;
		data = pendingRequests === 0 || forcing || cachedControllers && cachedControllers.indexOf(controller) > -1 ? data.view(controller) : {
			tag: "placeholder"
		};
		if (data.subtree === "retain") return data;
		data.attrs = data.attrs || {};
		data.attrs.key = key;
		updateLists(views, controllers, view, controller);
		return data
	}

	function markViews(data, cached, views, controllers) {
		var cachedControllers = cached && cached.controllers;
		while (data.view != null) {
			data = checkView(data, data.view.$original || data.view, cached, cachedControllers, controllers, views)
		}
		return data
	}

	function buildObject(data, cached, editable, parentElement, index, shouldReattach, namespace, configs) {
		var views = [];
		var controllers = [];
		data = markViews(data, cached, views, controllers);
		if (data.subtree === "retain") return cached;
		if (!data.tag && controllers.length) {
			throw new Error("Component template must return a virtual " + "element, not an array, string, etc.")
		}
		data.attrs = data.attrs || {};
		cached.attrs = cached.attrs || {};
		var dataAttrKeys = Object.keys(data.attrs);
		var hasKeys = dataAttrKeys.length > ("key" in data.attrs ? 1 : 0);
		maybeRecreateObject(data, cached, dataAttrKeys);
		if (!isString(data.tag)) return;
		var isNew = cached.nodes.length === 0;
		namespace = getObjectNamespace(data, namespace);
		var node;
		if (isNew) {
			node = constructNode(data, namespace);
			var attrs = constructAttrs(data, node, namespace, hasKeys);
			var children = constructChildren(data, node, cached, editable, namespace, configs);
			cached = reconstructCached(data, attrs, children, node, namespace, views, controllers)
		} else {
			node = buildUpdatedNode(cached, data, editable, hasKeys, namespace, views, configs, controllers)
		} if (isNew || shouldReattach === true && node != null) {
			insertNode(parentElement, node, index)
		}
		scheduleConfigsToBeCalled(configs, data, node, isNew, cached);
		return cached
	}

	function build(parentElement, parentTag, parentCache, parentIndex, data, cached, shouldReattach, index, editable, namespace, configs) {
		data = dataToString(data);
		if (data.subtree === "retain") return cached;
		cached = makeCache(data, cached, index, parentIndex, parentCache);
		if (isArray(data)) {
			return buildArray(data, cached, parentElement, index, parentTag, shouldReattach, editable, namespace, configs)
		} else if (data != null && isObject(data)) {
			return buildObject(data, cached, editable, parentElement, index, shouldReattach, namespace, configs)
		} else if (!isFunction(data)) {
			return handleTextNode(cached, data, index, parentElement, shouldReattach, editable, parentTag)
		} else {
			return cached
		}
	}

	function sortChanges(a, b) {
		return a.action - b.action || a.index - b.index
	}

	function copyStyleAttrs(node, dataAttr, cachedAttr) {
		for (var rule in dataAttr)
			if (hasOwn.call(dataAttr, rule)) {
				if (cachedAttr == null || cachedAttr[rule] !== dataAttr[rule]) {
					node.style[rule] = dataAttr[rule]
				}
			}
		for (rule in cachedAttr)
			if (hasOwn.call(cachedAttr, rule)) {
				if (!hasOwn.call(dataAttr, rule)) node.style[rule] = ""
			}
	}
	var shouldUseSetAttribute = {
		list: 1,
		style: 1,
		form: 1,
		type: 1,
		width: 1,
		height: 1
	};

	function setSingleAttr(node, attrName, dataAttr, cachedAttr, tag, namespace) {
		if (attrName === "config" || attrName === "key") {
			return true
		} else if (isFunction(dataAttr) && attrName.slice(0, 2) === "on") {
			node[attrName] = autoredraw(dataAttr, node)
		} else if (attrName === "style" && dataAttr != null && isObject(dataAttr)) {
			copyStyleAttrs(node, dataAttr, cachedAttr)
		} else if (namespace != null) {
			if (attrName === "href") {
				node.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataAttr)
			} else {
				node.setAttribute(attrName === "className" ? "class" : attrName, dataAttr)
			}
		} else if (attrName in node && !shouldUseSetAttribute[attrName]) {
			try {
				if (tag !== "input" || node[attrName] !== dataAttr) {
					node[attrName] = dataAttr
				}
			} catch (e) {
				node.setAttribute(attrName, dataAttr)
			}
		} else node.setAttribute(attrName, dataAttr)
	}

	function trySetAttr(node, attrName, dataAttr, cachedAttr, cachedAttrs, tag, namespace) {
		if (!(attrName in cachedAttrs) || cachedAttr !== dataAttr) {
			cachedAttrs[attrName] = dataAttr;
			try {
				return setSingleAttr(node, attrName, dataAttr, cachedAttr, tag, namespace)
			} catch (e) {
				if (e.message.indexOf("Invalid argument") < 0) throw e
			}
		} else if (attrName === "value" && tag === "input" && node.value !== dataAttr) {
			node.value = dataAttr
		}
	}

	function setAttributes(node, tag, dataAttrs, cachedAttrs, namespace) {
		for (var attrName in dataAttrs)
			if (hasOwn.call(dataAttrs, attrName)) {
				if (trySetAttr(node, attrName, dataAttrs[attrName], cachedAttrs[attrName], cachedAttrs, tag, namespace)) {
					continue
				}
			}
		return cachedAttrs
	}

	function clear(nodes, cached) {
		for (var i = nodes.length - 1; i > -1; i--) {
			if (nodes[i] && nodes[i].parentNode) {
				try {
					nodes[i].parentNode.removeChild(nodes[i])
				} catch (e) {}
				cached = [].concat(cached);
				if (cached[i]) unload(cached[i])
			}
		}
		if (nodes.length) {
			nodes.length = 0
		}
	}

	function unload(cached) {
		if (cached.configContext && isFunction(cached.configContext.onunload)) {
			cached.configContext.onunload();
			cached.configContext.onunload = null
		}
		if (cached.controllers) {
			forEach(cached.controllers, function(controller) {
				if (isFunction(controller.onunload)) {
					controller.onunload({
						preventDefault: noop
					})
				}
			})
		}
		if (cached.children) {
			if (isArray(cached.children)) forEach(cached.children, unload);
			else if (cached.children.tag) unload(cached.children)
		}
	}

	function appendTextFragment(parentElement, data) {
		try {
			parentElement.appendChild($document.createRange().createContextualFragment(data))
		} catch (e) {
			parentElement.insertAdjacentHTML("beforeend", data)
		}
	}

	function injectHTML(parentElement, index, data) {
		var nextSibling = parentElement.childNodes[index];
		if (nextSibling) {
			var isElement = nextSibling.nodeType !== 1;
			var placeholder = $document.createElement("span");
			if (isElement) {
				parentElement.insertBefore(placeholder, nextSibling || null);
				placeholder.insertAdjacentHTML("beforebegin", data);
				parentElement.removeChild(placeholder)
			} else {
				nextSibling.insertAdjacentHTML("beforebegin", data)
			}
		} else {
			appendTextFragment(parentElement, data)
		}
		var nodes = [];
		while (parentElement.childNodes[index] !== nextSibling) {
			nodes.push(parentElement.childNodes[index]);
			index++
		}
		return nodes
	}

	function autoredraw(callback, object) {
		return function(e) {
			e = e || event;
			m.redraw.strategy("diff");
			m.startComputation();
			try {
				return callback.call(object, e)
			} finally {
				endFirstComputation()
			}
		}
	}
	var html;
	var documentNode = {
		appendChild: function(node) {
			if (html === undefined) html = $document.createElement("html");
			if ($document.documentElement && $document.documentElement !== node) {
				$document.replaceChild(node, $document.documentElement)
			} else {
				$document.appendChild(node)
			}
			this.childNodes = $document.childNodes
		},
		insertBefore: function(node) {
			this.appendChild(node)
		},
		childNodes: []
	};
	var nodeCache = [];
	var cellCache = {};
	m.render = function(root, cell, forceRecreation) {
		if (!root) {
			throw new Error("Ensure the DOM element being passed to " + "m.route/m.mount/m.render is not undefined.")
		}
		var configs = [];
		var id = getCellCacheKey(root);
		var isDocumentRoot = root === $document;
		var node;
		if (isDocumentRoot || root === $document.documentElement) {
			node = documentNode
		} else {
			node = root
		} if (isDocumentRoot && cell.tag !== "html") {
			cell = {
				tag: "html",
				attrs: {},
				children: cell
			}
		}
		if (cellCache[id] === undefined) clear(node.childNodes);
		if (forceRecreation === true) reset(root);
		cellCache[id] = build(node, null, undefined, undefined, cell, cellCache[id], false, 0, null, undefined, configs);
		forEach(configs, function(config) {
			config()
		})
	};

	function getCellCacheKey(element) {
		var index = nodeCache.indexOf(element);
		return index < 0 ? nodeCache.push(element) - 1 : index
	}
	m.trust = function(value) {
		value = new String(value);
		value.$trusted = true;
		return value
	};

	function gettersetter(store) {
		function prop() {
			if (arguments.length) store = arguments[0];
			return store
		}
		prop.toJSON = function() {
			return store
		};
		return prop
	}
	m.prop = function(store) {
		if ((store != null && isObject(store) || isFunction(store)) && isFunction(store.then)) {
			return propify(store)
		}
		return gettersetter(store)
	};
	var roots = [];
	var components = [];
	var controllers = [];
	var lastRedrawId = null;
	var lastRedrawCallTime = 0;
	var computePreRedrawHook = null;
	var computePostRedrawHook = null;
	var topComponent;
	var FRAME_BUDGET = 16;

	function parameterize(component, args) {
		function controller() {
			return (component.controller || noop).apply(this, args) || this
		}
		if (component.controller) {
			controller.prototype = component.controller.prototype
		}

		function view(ctrl) {
			var currentArgs = [ctrl].concat(args);
			for (var i = 1; i < arguments.length; i++) {
				currentArgs.push(arguments[i])
			}
			return component.view.apply(component, currentArgs)
		}
		view.$original = component.view;
		var output = {
			controller: controller,
			view: view
		};
		if (args[0] && args[0].key != null) output.attrs = {
			key: args[0].key
		};
		return output
	}
	m.component = function(component) {
		var args = [].slice.call(arguments, 1);
		return parameterize(component, args)
	};

	function checkPrevented(component, root, index, isPrevented) {
		if (!isPrevented) {
			m.redraw.strategy("all");
			m.startComputation();
			roots[index] = root;
			var currentComponent;
			if (component) {
				currentComponent = topComponent = component
			} else {
				currentComponent = topComponent = component = {
					controller: noop
				}
			}
			var controller = new(component.controller || noop);
			if (currentComponent === topComponent) {
				controllers[index] = controller;
				components[index] = component
			}
			endFirstComputation();
			if (component === null) {
				removeRootElement(root, index)
			}
			return controllers[index]
		} else if (component == null) {
			removeRootElement(root, index)
		}
	}
	m.mount = m.module = function(root, component) {
		if (!root) {
			throw new Error("Please ensure the DOM element exists before " + "rendering a template into it.")
		}
		var index = roots.indexOf(root);
		if (index < 0) index = roots.length;
		var isPrevented = false;
		var event = {
			preventDefault: function() {
				isPrevented = true;
				computePreRedrawHook = computePostRedrawHook = null
			}
		};
		forEach(unloaders, function(unloader) {
			unloader.handler.call(unloader.controller, event);
			unloader.controller.onunload = null
		});
		if (isPrevented) {
			forEach(unloaders, function(unloader) {
				unloader.controller.onunload = unloader.handler
			})
		} else {
			unloaders = []
		} if (controllers[index] && isFunction(controllers[index].onunload)) {
			controllers[index].onunload(event)
		}
		return checkPrevented(component, root, index, isPrevented)
	};

	function removeRootElement(root, index) {
		roots.splice(index, 1);
		controllers.splice(index, 1);
		components.splice(index, 1);
		reset(root);
		nodeCache.splice(getCellCacheKey(root), 1)
	}
	var redrawing = false;
	m.redraw = function(force) {
		if (redrawing) return;
		redrawing = true;
		if (force) forcing = true;
		try {
			if (lastRedrawId && !force) {
				if ($requestAnimationFrame === global.requestAnimationFrame || new Date - lastRedrawCallTime > FRAME_BUDGET) {
					if (lastRedrawId > 0) $cancelAnimationFrame(lastRedrawId);
					lastRedrawId = $requestAnimationFrame(redraw, FRAME_BUDGET)
				}
			} else {
				redraw();
				lastRedrawId = $requestAnimationFrame(function() {
					lastRedrawId = null
				}, FRAME_BUDGET)
			}
		} finally {
			redrawing = forcing = false
		}
	};
	m.redraw.strategy = m.prop();

	function redraw() {
		if (computePreRedrawHook) {
			computePreRedrawHook();
			computePreRedrawHook = null
		}
		forEach(roots, function(root, i) {
			var component = components[i];
			if (controllers[i]) {
				var args = [controllers[i]];
				m.render(root, component.view ? component.view(controllers[i], args) : "")
			}
		});
		if (computePostRedrawHook) {
			computePostRedrawHook();
			computePostRedrawHook = null
		}
		lastRedrawId = null;
		lastRedrawCallTime = new Date;
		m.redraw.strategy("diff")
	}

	function endFirstComputation() {
		if (m.redraw.strategy() === "none") {
			pendingRequests--;
			m.redraw.strategy("diff")
		} else {
			m.endComputation()
		}
	}
	m.withAttr = function(prop, withAttrCallback, callbackThis) {
		return function(e) {
			e = e || event;
			var currentTarget = e.currentTarget || this;
			var _this = callbackThis || this;
			var target = prop in currentTarget ? currentTarget[prop] : currentTarget.getAttribute(prop);
			withAttrCallback.call(_this, target)
		}
	};
	var modes = {
		pathname: "",
		hash: "#",
		search: "?"
	};
	var redirect = noop;
	var isDefaultRoute = false;
	var routeParams, currentRoute;
	m.route = function(root, arg1, arg2, vdom) {
		if (arguments.length === 0) return currentRoute;
		if (arguments.length === 3 && isString(arg1)) {
			redirect = function(source) {
				var path = currentRoute = normalizeRoute(source);
				if (!routeByValue(root, arg2, path)) {
					if (isDefaultRoute) {
						throw new Error("Ensure the default route matches " + "one of the routes defined in m.route")
					}
					isDefaultRoute = true;
					m.route(arg1, true);
					isDefaultRoute = false
				}
			};
			var listener = m.route.mode === "hash" ? "onhashchange" : "onpopstate";
			global[listener] = function() {
				var path = $location[m.route.mode];
				if (m.route.mode === "pathname") path += $location.search;
				if (currentRoute !== normalizeRoute(path)) redirect(path)
			};
			computePreRedrawHook = setScroll;
			global[listener]();
			return
		}
		if (root.addEventListener || root.attachEvent) {
			var base = m.route.mode !== "pathname" ? $location.pathname : "";
			root.href = base + modes[m.route.mode] + vdom.attrs.href;
			if (root.addEventListener) {
				root.removeEventListener("click", routeUnobtrusive);
				root.addEventListener("click", routeUnobtrusive)
			} else {
				root.detachEvent("onclick", routeUnobtrusive);
				root.attachEvent("onclick", routeUnobtrusive)
			}
			return
		}
		if (isString(root)) {
			var oldRoute = currentRoute;
			currentRoute = root;
			var args = arg1 || {};
			var queryIndex = currentRoute.indexOf("?");
			var params;
			if (queryIndex > -1) {
				params = parseQueryString(currentRoute.slice(queryIndex + 1))
			} else {
				params = {}
			}
			for (var i in args)
				if (hasOwn.call(args, i)) {
					params[i] = args[i]
				}
			var querystring = buildQueryString(params);
			var currentPath;
			if (queryIndex > -1) {
				currentPath = currentRoute.slice(0, queryIndex)
			} else {
				currentPath = currentRoute
			} if (querystring) {
				currentRoute = currentPath + (currentPath.indexOf("?") === -1 ? "?" : "&") + querystring
			}
			var replaceHistory = (arguments.length === 3 ? arg2 : arg1) === true || oldRoute === root;
			if (global.history.pushState) {
				var method = replaceHistory ? "replaceState" : "pushState";
				computePreRedrawHook = setScroll;
				computePostRedrawHook = function() {
					global.history[method](null, $document.title, modes[m.route.mode] + currentRoute)
				};
				redirect(modes[m.route.mode] + currentRoute)
			} else {
				$location[m.route.mode] = currentRoute;
				redirect(modes[m.route.mode] + currentRoute)
			}
		}
	};
	m.route.param = function(key) {
		if (!routeParams) {
			throw new Error("You must call m.route(element, defaultRoute, " + "routes) before calling m.route.param()")
		}
		if (!key) {
			return routeParams
		}
		return routeParams[key]
	};
	m.route.mode = "search";

	function normalizeRoute(route) {
		return route.slice(modes[m.route.mode].length)
	}

	function routeByValue(root, router, path) {
		routeParams = {};
		var queryStart = path.indexOf("?");
		if (queryStart !== -1) {
			routeParams = parseQueryString(path.substr(queryStart + 1, path.length));
			path = path.substr(0, queryStart)
		}
		var keys = Object.keys(router);
		var index = keys.indexOf(path);
		if (index !== -1) {
			m.mount(root, router[keys[index]]);
			return true
		}
		for (var route in router)
			if (hasOwn.call(router, route)) {
				if (route === path) {
					m.mount(root, router[route]);
					return true
				}
				var matcher = new RegExp("^" + route.replace(/:[^\/]+?\.{3}/g, "(.*?)").replace(/:[^\/]+/g, "([^\\/]+)") + "/?$");
				if (matcher.test(path)) {
					path.replace(matcher, function() {
						var keys = route.match(/:[^\/]+/g) || [];
						var values = [].slice.call(arguments, 1, -2);
						forEach(keys, function(key, i) {
							routeParams[key.replace(/:|\./g, "")] = decodeURIComponent(values[i])
						});
						m.mount(root, router[route])
					});
					return true
				}
			}
	}

	function routeUnobtrusive(e) {
		e = e || event;
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) return;
		if (e.preventDefault) {
			e.preventDefault()
		} else {
			e.returnValue = false
		}
		var currentTarget = e.currentTarget || e.srcElement;
		var args;
		if (m.route.mode === "pathname" && currentTarget.search) {
			args = parseQueryString(currentTarget.search.slice(1))
		} else {
			args = {}
		}
		while (currentTarget && !/a/i.test(currentTarget.nodeName)) {
			currentTarget = currentTarget.parentNode
		}
		pendingRequests = 0;
		m.route(currentTarget[m.route.mode].slice(modes[m.route.mode].length), args)
	}

	function setScroll() {
		if (m.route.mode !== "hash" && $location.hash) {
			$location.hash = $location.hash
		} else {
			global.scrollTo(0, 0)
		}
	}

	function buildQueryString(object, prefix) {
		var duplicates = {};
		var str = [];
		for (var prop in object)
			if (hasOwn.call(object, prop)) {
				var key = prefix ? prefix + "[" + prop + "]" : prop;
				var value = object[prop];
				if (value === null) {
					str.push(encodeURIComponent(key))
				} else if (isObject(value)) {
					str.push(buildQueryString(value, key))
				} else if (isArray(value)) {
					var keys = [];
					duplicates[key] = duplicates[key] || {};
					forEach(value, function(item) {
						if (!duplicates[key][item]) {
							duplicates[key][item] = true;
							keys.push(encodeURIComponent(key) + "=" + encodeURIComponent(item))
						}
					});
					str.push(keys.join("&"))
				} else if (value !== undefined) {
					str.push(encodeURIComponent(key) + "=" + encodeURIComponent(value))
				}
			}
		return str.join("&")
	}

	function parseQueryString(str) {
		if (str === "" || str == null) return {};
		if (str.charAt(0) === "?") str = str.slice(1);
		var pairs = str.split("&");
		var params = {};
		forEach(pairs, function(string) {
			var pair = string.split("=");
			var key = decodeURIComponent(pair[0]);
			var value = pair.length === 2 ? decodeURIComponent(pair[1]) : null;
			if (params[key] != null) {
				if (!isArray(params[key])) params[key] = [params[key]];
				params[key].push(value)
			} else params[key] = value
		});
		return params
	}
	m.route.buildQueryString = buildQueryString;
	m.route.parseQueryString = parseQueryString;

	function reset(root) {
		var cacheKey = getCellCacheKey(root);
		clear(root.childNodes, cellCache[cacheKey]);
		cellCache[cacheKey] = undefined
	}
	m.deferred = function() {
		var deferred = new Deferred;
		deferred.promise = propify(deferred.promise);
		return deferred
	};

	function propify(promise, initialValue) {
		var prop = m.prop(initialValue);
		promise.then(prop);
		prop.then = function(resolve, reject) {
			return propify(promise.then(resolve, reject), initialValue)
		};
		prop.
		catch = prop.then.bind(null, null);
		return prop
	}
	var RESOLVING = 1;
	var REJECTING = 2;
	var RESOLVED = 3;
	var REJECTED = 4;

	function Deferred(onSuccess, onFailure) {
		var self = this;
		var state = 0;
		var promiseValue = 0;
		var next = [];
		self.promise = {};
		self.resolve = function(value) {
			if (!state) {
				promiseValue = value;
				state = RESOLVING;
				fire()
			}
			return self
		};
		self.reject = function(value) {
			if (!state) {
				promiseValue = value;
				state = REJECTING;
				fire()
			}
			return self
		};
		self.promise.then = function(onSuccess, onFailure) {
			var deferred = new Deferred(onSuccess, onFailure);
			if (state === RESOLVED) {
				deferred.resolve(promiseValue)
			} else if (state === REJECTED) {
				deferred.reject(promiseValue)
			} else {
				next.push(deferred)
			}
			return deferred.promise
		};

		function finish(type) {
			state = type || REJECTED;
			next.map(function(deferred) {
				if (state === RESOLVED) {
					deferred.resolve(promiseValue)
				} else {
					deferred.reject(promiseValue)
				}
			})
		}

		function thennable(then, success, failure, notThennable) {
			if ((promiseValue != null && isObject(promiseValue) || isFunction(promiseValue)) && isFunction(then)) {
				try {
					var count = 0;
					then.call(promiseValue, function(value) {
						if (count++) return;
						promiseValue = value;
						success()
					}, function(value) {
						if (count++) return;
						promiseValue = value;
						failure()
					})
				} catch (e) {
					m.deferred.onerror(e);
					promiseValue = e;
					failure()
				}
			} else {
				notThennable()
			}
		}

		function fire() {
			var then;
			try {
				then = promiseValue && promiseValue.then
			} catch (e) {
				m.deferred.onerror(e);
				promiseValue = e;
				state = REJECTING;
				return fire()
			}
			if (state === REJECTING) {
				m.deferred.onerror(promiseValue)
			}
			thennable(then, function() {
				state = RESOLVING;
				fire()
			}, function() {
				state = REJECTING;
				fire()
			}, function() {
				try {
					if (state === RESOLVING && isFunction(onSuccess)) {
						promiseValue = onSuccess(promiseValue)
					} else if (state === REJECTING && isFunction(onFailure)) {
						promiseValue = onFailure(promiseValue);
						state = RESOLVING
					}
				} catch (e) {
					m.deferred.onerror(e);
					promiseValue = e;
					return finish()
				}
				if (promiseValue === self) {
					promiseValue = TypeError();
					finish()
				} else {
					thennable(then, function() {
						finish(RESOLVED)
					}, finish, function() {
						finish(state === RESOLVING && RESOLVED)
					})
				}
			})
		}
	}
	m.deferred.onerror = function(e) {
		if (type.call(e) === "[object Error]" && !/ Error/.test(e.constructor.toString())) {
			pendingRequests = 0;
			throw e
		}
	};
	m.sync = function(args) {
		var deferred = m.deferred();
		var outstanding = args.length;
		var results = new Array(outstanding);
		var method = "resolve";

		function synchronizer(pos, resolved) {
			return function(value) {
				results[pos] = value;
				if (!resolved) method = "reject";
				if (--outstanding === 0) {
					deferred.promise(results);
					deferred[method](results)
				}
				return value
			}
		}
		if (args.length > 0) {
			forEach(args, function(arg, i) {
				arg.then(synchronizer(i, true), synchronizer(i, false))
			})
		} else {
			deferred.resolve([])
		}
		return deferred.promise
	};

	function identity(value) {
		return value
	}

	function handleJsonp(options) {
		var callbackKey = "mithril_callback_" + (new Date).getTime() + "_" + Math.round(Math.random() * 1e16).toString(36);
		var script = $document.createElement("script");
		global[callbackKey] = function(resp) {
			script.parentNode.removeChild(script);
			options.onload({
				type: "load",
				target: {
					responseText: resp
				}
			});
			global[callbackKey] = undefined
		};
		script.onerror = function() {
			script.parentNode.removeChild(script);
			options.onerror({
				type: "error",
				target: {
					status: 500,
					responseText: JSON.stringify({
						error: "Error making jsonp request"
					})
				}
			});
			global[callbackKey] = undefined;
			return false
		};
		script.onload = function() {
			return false
		};
		script.src = options.url + (options.url.indexOf("?") > 0 ? "&" : "?") + (options.callbackKey ? options.callbackKey : "callback") + "=" + callbackKey + "&" + buildQueryString(options.data || {});
		$document.body.appendChild(script)
	}

	function createXhr(options) {
		var xhr = new global.XMLHttpRequest;
		xhr.open(options.method, options.url, true, options.user, options.password);
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status >= 200 && xhr.status < 300) {
					options.onload({
						type: "load",
						target: xhr
					})
				} else {
					options.onerror({
						type: "error",
						target: xhr
					})
				}
			}
		};
		if (options.serialize === JSON.stringify && options.data && options.method !== "GET") {
			xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8")
		}
		if (options.deserialize === JSON.parse) {
			xhr.setRequestHeader("Accept", "application/json, text/*")
		}
		if (isFunction(options.config)) {
			var maybeXhr = options.config(xhr, options);
			if (maybeXhr != null) xhr = maybeXhr
		}
		var data = options.method === "GET" || !options.data ? "" : options.data;
		if (data && !isString(data) && data.constructor !== global.FormData) {
			throw new Error("Request data should be either be a string or " + "FormData. Check the `serialize` option in `m.request`")
		}
		xhr.send(data);
		return xhr
	}

	function ajax(options) {
		if (options.dataType && options.dataType.toLowerCase() === "jsonp") {
			return handleJsonp(options)
		} else {
			return createXhr(options)
		}
	}

	function bindData(options, data, serialize) {
		if (options.method === "GET" && options.dataType !== "jsonp") {
			var prefix = options.url.indexOf("?") < 0 ? "?" : "&";
			var querystring = buildQueryString(data);
			options.url += querystring ? prefix + querystring : ""
		} else {
			options.data = serialize(data)
		}
	}

	function parameterizeUrl(url, data) {
		if (data) {
			url = url.replace(/:[a-z]\w+/gi, function(token) {
				var key = token.slice(1);
				var value = data[key];
				delete data[key];
				return value
			})
		}
		return url
	}
	m.request = function(options) {
		if (options.background !== true) m.startComputation();
		var deferred = new Deferred;
		var isJSONP = options.dataType && options.dataType.toLowerCase() === "jsonp";
		var serialize, deserialize, extract;
		if (isJSONP) {
			serialize = options.serialize = deserialize = options.deserialize = identity;
			extract = function(jsonp) {
				return jsonp.responseText
			}
		} else {
			serialize = options.serialize = options.serialize || JSON.stringify;
			deserialize = options.deserialize = options.deserialize || JSON.parse;
			extract = options.extract || function(xhr) {
				if (xhr.responseText.length || deserialize !== JSON.parse) {
					return xhr.responseText
				} else {
					return null
				}
			}
		}
		options.method = (options.method || "GET").toUpperCase();
		options.url = parameterizeUrl(options.url, options.data);
		bindData(options, options.data, serialize);
		options.onload = options.onerror = function(ev) {
			try {
				ev = ev || event;
				var response = deserialize(extract(ev.target, options));
				if (ev.type === "load") {
					if (options.unwrapSuccess) {
						response = options.unwrapSuccess(response, ev.target)
					}
					if (isArray(response) && options.type) {
						forEach(response, function(res, i) {
							response[i] = new options.type(res)
						})
					} else if (options.type) {
						response = new options.type(response)
					}
					deferred.resolve(response)
				} else {
					if (options.unwrapError) {
						response = options.unwrapError(response, ev.target)
					}
					deferred.reject(response)
				}
			} catch (e) {
				deferred.reject(e)
			} finally {
				if (options.background !== true) m.endComputation()
			}
		};
		ajax(options);
		deferred.promise = propify(deferred.promise, options.initialValue);
		return deferred.promise
	};
	return m
});
if (typeof Paho === "undefined") {
	Paho = {}
}
Paho.MQTT = function(global) {
	var version = "@VERSION@";
	var buildLevel = "@BUILDLEVEL@";
	var MESSAGE_TYPE = {
		CONNECT: 1,
		CONNACK: 2,
		PUBLISH: 3,
		PUBACK: 4,
		PUBREC: 5,
		PUBREL: 6,
		PUBCOMP: 7,
		SUBSCRIBE: 8,
		SUBACK: 9,
		UNSUBSCRIBE: 10,
		UNSUBACK: 11,
		PINGREQ: 12,
		PINGRESP: 13,
		DISCONNECT: 14
	};
	var validate = function(obj, keys) {
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (keys.hasOwnProperty(key)) {
					if (typeof obj[key] !== keys[key]) throw new Error(format(ERROR.INVALID_TYPE, [typeof obj[key], key]))
				} else {
					var errorStr = "Unknown property, " + key + ". Valid properties are:";
					for (var key in keys)
						if (keys.hasOwnProperty(key)) errorStr = errorStr + " " + key;
					throw new Error(errorStr)
				}
			}
		}
	};
	var scope = function(f, scope) {
		return function() {
			return f.apply(scope, arguments)
		}
	};
	var ERROR = {
		OK: {
			code: 0,
			text: "AMQJSC0000I OK."
		},
		CONNECT_TIMEOUT: {
			code: 1,
			text: "AMQJSC0001E Connect timed out."
		},
		SUBSCRIBE_TIMEOUT: {
			code: 2,
			text: "AMQJS0002E Subscribe timed out."
		},
		UNSUBSCRIBE_TIMEOUT: {
			code: 3,
			text: "AMQJS0003E Unsubscribe timed out."
		},
		PING_TIMEOUT: {
			code: 4,
			text: "AMQJS0004E Ping timed out."
		},
		INTERNAL_ERROR: {
			code: 5,
			text: "AMQJS0005E Internal error. Error Message: {0}, Stack trace: {1}"
		},
		CONNACK_RETURNCODE: {
			code: 6,
			text: "AMQJS0006E Bad Connack return code:{0} {1}."
		},
		SOCKET_ERROR: {
			code: 7,
			text: "AMQJS0007E Socket error:{0}."
		},
		SOCKET_CLOSE: {
			code: 8,
			text: "AMQJS0008I Socket closed."
		},
		MALFORMED_UTF: {
			code: 9,
			text: "AMQJS0009E Malformed UTF data:{0} {1} {2}."
		},
		UNSUPPORTED: {
			code: 10,
			text: "AMQJS0010E {0} is not supported by this browser."
		},
		INVALID_STATE: {
			code: 11,
			text: "AMQJS0011E Invalid state {0}."
		},
		INVALID_TYPE: {
			code: 12,
			text: "AMQJS0012E Invalid type {0} for {1}."
		},
		INVALID_ARGUMENT: {
			code: 13,
			text: "AMQJS0013E Invalid argument {0} for {1}."
		},
		UNSUPPORTED_OPERATION: {
			code: 14,
			text: "AMQJS0014E Unsupported operation."
		},
		INVALID_STORED_DATA: {
			code: 15,
			text: "AMQJS0015E Invalid data in local storage key={0} value={1}."
		},
		INVALID_MQTT_MESSAGE_TYPE: {
			code: 16,
			text: "AMQJS0016E Invalid MQTT message type {0}."
		},
		MALFORMED_UNICODE: {
			code: 17,
			text: "AMQJS0017E Malformed Unicode string:{0} {1}."
		}
	};
	var CONNACK_RC = {
		0: "Connection Accepted",
		1: "Connection Refused: unacceptable protocol version",
		2: "Connection Refused: identifier rejected",
		3: "Connection Refused: server unavailable",
		4: "Connection Refused: bad user name or password",
		5: "Connection Refused: not authorized"
	};
	var format = function(error, substitutions) {
		var text = error.text;
		if (substitutions) {
			var field, start;
			for (var i = 0; i < substitutions.length; i++) {
				field = "{" + i + "}";
				start = text.indexOf(field);
				if (start > 0) {
					var part1 = text.substring(0, start);
					var part2 = text.substring(start + field.length);
					text = part1 + substitutions[i] + part2
				}
			}
		}
		return text
	};
	var MqttProtoIdentifierv3 = [0, 6, 77, 81, 73, 115, 100, 112, 3];
	var MqttProtoIdentifierv4 = [0, 4, 77, 81, 84, 84, 4];
	var WireMessage = function(type, options) {
		this.type = type;
		for (var name in options) {
			if (options.hasOwnProperty(name)) {
				this[name] = options[name]
			}
		}
	};
	WireMessage.prototype.encode = function() {
		var first = (this.type & 15) << 4;
		var remLength = 0;
		var topicStrLength = new Array;
		var destinationNameLength = 0;
		if (this.messageIdentifier != undefined) remLength += 2;
		switch (this.type) {
			case MESSAGE_TYPE.CONNECT:
				switch (this.mqttVersion) {
					case 3:
						remLength += MqttProtoIdentifierv3.length + 3;
						break;
					case 4:
						remLength += MqttProtoIdentifierv4.length + 3;
						break
				}
				remLength += UTF8Length(this.clientId) + 2;
				if (this.willMessage != undefined) {
					remLength += UTF8Length(this.willMessage.destinationName) + 2;
					var willMessagePayloadBytes = this.willMessage.payloadBytes;
					if (!(willMessagePayloadBytes instanceof Uint8Array)) willMessagePayloadBytes = new Uint8Array(payloadBytes);
					remLength += willMessagePayloadBytes.byteLength + 2
				}
				if (this.userName != undefined) remLength += UTF8Length(this.userName) + 2;
				if (this.password != undefined) remLength += UTF8Length(this.password) + 2;
				break;
			case MESSAGE_TYPE.SUBSCRIBE:
				first |= 2;
				for (var i = 0; i < this.topics.length; i++) {
					topicStrLength[i] = UTF8Length(this.topics[i]);
					remLength += topicStrLength[i] + 2
				}
				remLength += this.requestedQos.length;
				break;
			case MESSAGE_TYPE.UNSUBSCRIBE:
				first |= 2;
				for (var i = 0; i < this.topics.length; i++) {
					topicStrLength[i] = UTF8Length(this.topics[i]);
					remLength += topicStrLength[i] + 2
				}
				break;
			case MESSAGE_TYPE.PUBREL:
				first |= 2;
				break;
			case MESSAGE_TYPE.PUBLISH:
				if (this.payloadMessage.duplicate) first |= 8;
				first = first |= this.payloadMessage.qos << 1;
				if (this.payloadMessage.retained) first |= 1;
				destinationNameLength = UTF8Length(this.payloadMessage.destinationName);
				remLength += destinationNameLength + 2;
				var payloadBytes = this.payloadMessage.payloadBytes;
				remLength += payloadBytes.byteLength;
				if (payloadBytes instanceof ArrayBuffer) payloadBytes = new Uint8Array(payloadBytes);
				else if (!(payloadBytes instanceof Uint8Array)) payloadBytes = new Uint8Array(payloadBytes.buffer);
				break;
			case MESSAGE_TYPE.DISCONNECT:
				break;
			default:
		}
		var mbi = encodeMBI(remLength);
		var pos = mbi.length + 1;
		var buffer = new ArrayBuffer(remLength + pos);
		var byteStream = new Uint8Array(buffer);
		byteStream[0] = first;
		byteStream.set(mbi, 1);
		if (this.type == MESSAGE_TYPE.PUBLISH) pos = writeString(this.payloadMessage.destinationName, destinationNameLength, byteStream, pos);
		else if (this.type == MESSAGE_TYPE.CONNECT) {
			switch (this.mqttVersion) {
				case 3:
					byteStream.set(MqttProtoIdentifierv3, pos);
					pos += MqttProtoIdentifierv3.length;
					break;
				case 4:
					byteStream.set(MqttProtoIdentifierv4, pos);
					pos += MqttProtoIdentifierv4.length;
					break
			}
			var connectFlags = 0;
			if (this.cleanSession) connectFlags = 2;
			if (this.willMessage != undefined) {
				connectFlags |= 4;
				connectFlags |= this.willMessage.qos << 3;
				if (this.willMessage.retained) {
					connectFlags |= 32
				}
			}
			if (this.userName != undefined) connectFlags |= 128;
			if (this.password != undefined) connectFlags |= 64;
			byteStream[pos++] = connectFlags;
			pos = writeUint16(this.keepAliveInterval, byteStream, pos)
		}
		if (this.messageIdentifier != undefined) pos = writeUint16(this.messageIdentifier, byteStream, pos);
		switch (this.type) {
			case MESSAGE_TYPE.CONNECT:
				pos = writeString(this.clientId, UTF8Length(this.clientId), byteStream, pos);
				if (this.willMessage != undefined) {
					pos = writeString(this.willMessage.destinationName, UTF8Length(this.willMessage.destinationName), byteStream, pos);
					pos = writeUint16(willMessagePayloadBytes.byteLength, byteStream, pos);
					byteStream.set(willMessagePayloadBytes, pos);
					pos += willMessagePayloadBytes.byteLength
				}
				if (this.userName != undefined) pos = writeString(this.userName, UTF8Length(this.userName), byteStream, pos);
				if (this.password != undefined) pos = writeString(this.password, UTF8Length(this.password), byteStream, pos);
				break;
			case MESSAGE_TYPE.PUBLISH:
				byteStream.set(payloadBytes, pos);
				break;
			case MESSAGE_TYPE.SUBSCRIBE:
				for (var i = 0; i < this.topics.length; i++) {
					pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
					byteStream[pos++] = this.requestedQos[i]
				}
				break;
			case MESSAGE_TYPE.UNSUBSCRIBE:
				for (var i = 0; i < this.topics.length; i++) pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
				break;
			default:
		}
		return buffer
	};

	function decodeMessage(input, pos) {
		var startingPos = pos;
		var first = input[pos];
		var type = first >> 4;
		var messageInfo = first &= 15;
		pos += 1;
		var digit;
		var remLength = 0;
		var multiplier = 1;
		do {
			if (pos == input.length) {
				return [null, startingPos]
			}
			digit = input[pos++];
			remLength += (digit & 127) * multiplier;
			multiplier *= 128
		} while ((digit & 128) != 0);
		var endPos = pos + remLength;
		if (endPos > input.length) {
			return [null, startingPos]
		}
		var wireMessage = new WireMessage(type);
		switch (type) {
			case MESSAGE_TYPE.CONNACK:
				var connectAcknowledgeFlags = input[pos++];
				if (connectAcknowledgeFlags & 1) wireMessage.sessionPresent = true;
				wireMessage.returnCode = input[pos++];
				break;
			case MESSAGE_TYPE.PUBLISH:
				var qos = messageInfo >> 1 & 3;
				var len = readUint16(input, pos);
				pos += 2;
				var topicName = parseUTF8(input, pos, len);
				pos += len;
				if (qos > 0) {
					wireMessage.messageIdentifier = readUint16(input, pos);
					pos += 2
				}
				var message = new Paho.MQTT.Message(input.subarray(pos, endPos));
				if ((messageInfo & 1) == 1) message.retained = true;
				if ((messageInfo & 8) == 8) message.duplicate = true;
				message.qos = qos;
				message.destinationName = topicName;
				wireMessage.payloadMessage = message;
				break;
			case MESSAGE_TYPE.PUBACK:
			case MESSAGE_TYPE.PUBREC:
			case MESSAGE_TYPE.PUBREL:
			case MESSAGE_TYPE.PUBCOMP:
			case MESSAGE_TYPE.UNSUBACK:
				wireMessage.messageIdentifier = readUint16(input, pos);
				break;
			case MESSAGE_TYPE.SUBACK:
				wireMessage.messageIdentifier = readUint16(input, pos);
				pos += 2;
				wireMessage.returnCode = input.subarray(pos, endPos);
				break;
			default:
		}
		return [wireMessage, endPos]
	}

	function writeUint16(input, buffer, offset) {
		buffer[offset++] = input >> 8;
		buffer[offset++] = input % 256;
		return offset
	}

	function writeString(input, utf8Length, buffer, offset) {
		offset = writeUint16(utf8Length, buffer, offset);
		stringToUTF8(input, buffer, offset);
		return offset + utf8Length
	}

	function readUint16(buffer, offset) {
		return 256 * buffer[offset] + buffer[offset + 1]
	}

	function encodeMBI(number) {
		var output = new Array(1);
		var numBytes = 0;
		do {
			var digit = number % 128;
			number = number >> 7;
			if (number > 0) {
				digit |= 128
			}
			output[numBytes++] = digit
		} while (number > 0 && numBytes < 4);
		return output
	}

	function UTF8Length(input) {
		var output = 0;
		for (var i = 0; i < input.length; i++) {
			var charCode = input.charCodeAt(i);
			if (charCode > 2047) {
				if (55296 <= charCode && charCode <= 56319) {
					i++;
					output++
				}
				output += 3
			} else if (charCode > 127) output += 2;
			else output++
		}
		return output
	}

	function stringToUTF8(input, output, start) {
		var pos = start;
		for (var i = 0; i < input.length; i++) {
			var charCode = input.charCodeAt(i);
			if (55296 <= charCode && charCode <= 56319) {
				var lowCharCode = input.charCodeAt(++i);
				if (isNaN(lowCharCode)) {
					throw new Error(format(ERROR.MALFORMED_UNICODE, [charCode, lowCharCode]))
				}
				charCode = (charCode - 55296 << 10) + (lowCharCode - 56320) + 65536
			}
			if (charCode <= 127) {
				output[pos++] = charCode
			} else if (charCode <= 2047) {
				output[pos++] = charCode >> 6 & 31 | 192;
				output[pos++] = charCode & 63 | 128
			} else if (charCode <= 65535) {
				output[pos++] = charCode >> 12 & 15 | 224;
				output[pos++] = charCode >> 6 & 63 | 128;
				output[pos++] = charCode & 63 | 128
			} else {
				output[pos++] = charCode >> 18 & 7 | 240;
				output[pos++] = charCode >> 12 & 63 | 128;
				output[pos++] = charCode >> 6 & 63 | 128;
				output[pos++] = charCode & 63 | 128
			}
		}
		return output
	}

	function parseUTF8(input, offset, length) {
		var output = "";
		var utf16;
		var pos = offset;
		while (pos < offset + length) {
			var byte1 = input[pos++];
			if (byte1 < 128) utf16 = byte1;
			else {
				var byte2 = input[pos++] - 128;
				if (byte2 < 0) throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), ""]));
				if (byte1 < 224) utf16 = 64 * (byte1 - 192) + byte2;
				else {
					var byte3 = input[pos++] - 128;
					if (byte3 < 0) throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16)]));
					if (byte1 < 240) utf16 = 4096 * (byte1 - 224) + 64 * byte2 + byte3;
					else {
						var byte4 = input[pos++] - 128;
						if (byte4 < 0) throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16), byte4.toString(16)]));
						if (byte1 < 248) utf16 = 262144 * (byte1 - 240) + 4096 * byte2 + 64 * byte3 + byte4;
						else throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16), byte4.toString(16)]))
					}
				}
			} if (utf16 > 65535) {
				utf16 -= 65536;
				output += String.fromCharCode(55296 + (utf16 >> 10));
				utf16 = 56320 + (utf16 & 1023)
			}
			output += String.fromCharCode(utf16)
		}
		return output
	}
	var Pinger = function(client, window, keepAliveInterval) {
		this._client = client;
		this._window = window;
		this._keepAliveInterval = keepAliveInterval * 1e3;
		this.isReset = false;
		var pingReq = new WireMessage(MESSAGE_TYPE.PINGREQ).encode();
		var doTimeout = function(pinger) {
			return function() {
				return doPing.apply(pinger)
			}
		};
		var doPing = function() {
			if (!this.isReset) {
				this._client._trace("Pinger.doPing", "Timed out");
				this._client._disconnected(ERROR.PING_TIMEOUT.code, format(ERROR.PING_TIMEOUT))
			} else {
				this.isReset = false;
				this._client._trace("Pinger.doPing", "send PINGREQ");
				this._client.socket.send(pingReq);
				this.timeout = this._window.setTimeout(doTimeout(this), this._keepAliveInterval)
			}
		};
		this.reset = function() {
			this.isReset = true;
			this._window.clearTimeout(this.timeout);
			if (this._keepAliveInterval > 0) this.timeout = setTimeout(doTimeout(this), this._keepAliveInterval)
		};
		this.cancel = function() {
			this._window.clearTimeout(this.timeout)
		}
	};
	var Timeout = function(client, window, timeoutSeconds, action, args) {
		this._window = window;
		if (!timeoutSeconds) timeoutSeconds = 30;
		var doTimeout = function(action, client, args) {
			return function() {
				return action.apply(client, args)
			}
		};
		this.timeout = setTimeout(doTimeout(action, client, args), timeoutSeconds * 1e3);
		this.cancel = function() {
			this._window.clearTimeout(this.timeout)
		}
	};
	var ClientImpl = function(uri, host, port, path, clientId) {
		if (!("WebSocket" in global && global["WebSocket"] !== null)) {
			throw new Error(format(ERROR.UNSUPPORTED, ["WebSocket"]))
		}
		if (!("localStorage" in global && global["localStorage"] !== null)) {
			throw new Error(format(ERROR.UNSUPPORTED, ["localStorage"]))
		}
		if (!("ArrayBuffer" in global && global["ArrayBuffer"] !== null)) {
			throw new Error(format(ERROR.UNSUPPORTED, ["ArrayBuffer"]))
		}
		this._trace("Paho.MQTT.Client", uri, host, port, path, clientId);
		this.host = host;
		this.port = port;
		this.path = path;
		this.uri = uri;
		this.clientId = clientId;
		this._localKey = host + ":" + port + (path != "/mqtt" ? ":" + path : "") + ":" + clientId + ":";
		this._msg_queue = [];
		this._sentMessages = {};
		this._receivedMessages = {};
		this._notify_msg_sent = {};
		this._message_identifier = 1;
		this._sequence = 0;
		for (var key in localStorage)
			if (key.indexOf("Sent:" + this._localKey) == 0 || key.indexOf("Received:" + this._localKey) == 0) this.restore(key)
	};
	ClientImpl.prototype.host;
	ClientImpl.prototype.port;
	ClientImpl.prototype.path;
	ClientImpl.prototype.uri;
	ClientImpl.prototype.clientId;
	ClientImpl.prototype.socket;
	ClientImpl.prototype.connected = false;
	ClientImpl.prototype.maxMessageIdentifier = 65536;
	ClientImpl.prototype.connectOptions;
	ClientImpl.prototype.hostIndex;
	ClientImpl.prototype.onConnectionLost;
	ClientImpl.prototype.onMessageDelivered;
	ClientImpl.prototype.onMessageArrived;
	ClientImpl.prototype.traceFunction;
	ClientImpl.prototype._msg_queue = null;
	ClientImpl.prototype._connectTimeout;
	ClientImpl.prototype.sendPinger = null;
	ClientImpl.prototype.receivePinger = null;
	ClientImpl.prototype.receiveBuffer = null;
	ClientImpl.prototype._traceBuffer = null;
	ClientImpl.prototype._MAX_TRACE_ENTRIES = 100;
	ClientImpl.prototype.connect = function(connectOptions) {
		var connectOptionsMasked = this._traceMask(connectOptions, "password");
		this._trace("Client.connect", connectOptionsMasked, this.socket, this.connected);
		if (this.connected) throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));
		if (this.socket) throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));
		this.connectOptions = connectOptions;
		if (connectOptions.uris) {
			this.hostIndex = 0;
			this._doConnect(connectOptions.uris[0])
		} else {
			this._doConnect(this.uri)
		}
	};
	ClientImpl.prototype.subscribe = function(filter, subscribeOptions) {
		this._trace("Client.subscribe", filter, subscribeOptions);
		if (!this.connected) throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
		var wireMessage = new WireMessage(MESSAGE_TYPE.SUBSCRIBE);
		wireMessage.topics = [filter];
		if (subscribeOptions.qos != undefined) wireMessage.requestedQos = [subscribeOptions.qos];
		else wireMessage.requestedQos = [0]; if (subscribeOptions.onSuccess) {
			wireMessage.onSuccess = function(grantedQos) {
				subscribeOptions.onSuccess({
					invocationContext: subscribeOptions.invocationContext,
					grantedQos: grantedQos
				})
			}
		}
		if (subscribeOptions.onFailure) {
			wireMessage.onFailure = function(errorCode) {
				subscribeOptions.onFailure({
					invocationContext: subscribeOptions.invocationContext,
					errorCode: errorCode
				})
			}
		}
		if (subscribeOptions.timeout) {
			wireMessage.timeOut = new Timeout(this, window, subscribeOptions.timeout, subscribeOptions.onFailure, [{
				invocationContext: subscribeOptions.invocationContext,
				errorCode: ERROR.SUBSCRIBE_TIMEOUT.code,
				errorMessage: format(ERROR.SUBSCRIBE_TIMEOUT)
			}])
		}
		this._requires_ack(wireMessage);
		this._schedule_message(wireMessage)
	};
	ClientImpl.prototype.unsubscribe = function(filter, unsubscribeOptions) {
		this._trace("Client.unsubscribe", filter, unsubscribeOptions);
		if (!this.connected) throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
		var wireMessage = new WireMessage(MESSAGE_TYPE.UNSUBSCRIBE);
		wireMessage.topics = [filter];
		if (unsubscribeOptions.onSuccess) {
			wireMessage.callback = function() {
				unsubscribeOptions.onSuccess({
					invocationContext: unsubscribeOptions.invocationContext
				})
			}
		}
		if (unsubscribeOptions.timeout) {
			wireMessage.timeOut = new Timeout(this, window, unsubscribeOptions.timeout, unsubscribeOptions.onFailure, [{
				invocationContext: unsubscribeOptions.invocationContext,
				errorCode: ERROR.UNSUBSCRIBE_TIMEOUT.code,
				errorMessage: format(ERROR.UNSUBSCRIBE_TIMEOUT)
			}])
		}
		this._requires_ack(wireMessage);
		this._schedule_message(wireMessage)
	};
	ClientImpl.prototype.send = function(message) {
		this._trace("Client.send", message);
		if (!this.connected) throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
		wireMessage = new WireMessage(MESSAGE_TYPE.PUBLISH);
		wireMessage.payloadMessage = message;
		if (message.qos > 0) this._requires_ack(wireMessage);
		else if (this.onMessageDelivered) this._notify_msg_sent[wireMessage] = this.onMessageDelivered(wireMessage.payloadMessage);
		this._schedule_message(wireMessage)
	};
	ClientImpl.prototype.disconnect = function() {
		this._trace("Client.disconnect");
		if (!this.socket) throw new Error(format(ERROR.INVALID_STATE, ["not connecting or connected"]));
		wireMessage = new WireMessage(MESSAGE_TYPE.DISCONNECT);
		this._notify_msg_sent[wireMessage] = scope(this._disconnected, this);
		this._schedule_message(wireMessage)
	};
	ClientImpl.prototype.getTraceLog = function() {
		if (this._traceBuffer !== null) {
			this._trace("Client.getTraceLog", new Date);
			this._trace("Client.getTraceLog in flight messages", this._sentMessages.length);
			for (var key in this._sentMessages) this._trace("_sentMessages ", key, this._sentMessages[key]);
			for (var key in this._receivedMessages) this._trace("_receivedMessages ", key, this._receivedMessages[key]);
			return this._traceBuffer
		}
	};
	ClientImpl.prototype.startTrace = function() {
		if (this._traceBuffer === null) {
			this._traceBuffer = []
		}
		this._trace("Client.startTrace", new Date, version)
	};
	ClientImpl.prototype.stopTrace = function() {
		delete this._traceBuffer
	};
	ClientImpl.prototype._doConnect = function(wsurl) {
		if (this.connectOptions.useSSL) {
			var uriParts = wsurl.split(":");
			uriParts[0] = "wss";
			wsurl = uriParts.join(":")
		}
		this.connected = false;
		if (this.connectOptions.mqttVersion < 4) {
			this.socket = new WebSocket(wsurl, ["mqttv3.1"])
		} else {
			this.socket = new WebSocket(wsurl, ["mqtt"])
		}
		this.socket.binaryType = "arraybuffer";
		this.socket.onopen = scope(this._on_socket_open, this);
		this.socket.onmessage = scope(this._on_socket_message, this);
		this.socket.onerror = scope(this._on_socket_error, this);
		this.socket.onclose = scope(this._on_socket_close, this);
		this.sendPinger = new Pinger(this, window, this.connectOptions.keepAliveInterval);
		this.receivePinger = new Pinger(this, window, this.connectOptions.keepAliveInterval);
		this._connectTimeout = new Timeout(this, window, this.connectOptions.timeout, this._disconnected, [ERROR.CONNECT_TIMEOUT.code, format(ERROR.CONNECT_TIMEOUT)])
	};
	ClientImpl.prototype._schedule_message = function(message) {
		this._msg_queue.push(message);
		if (this.connected) {
			this._process_queue()
		}
	};
	ClientImpl.prototype.store = function(prefix, wireMessage) {
		var storedMessage = {
			type: wireMessage.type,
			messageIdentifier: wireMessage.messageIdentifier,
			version: 1
		};
		switch (wireMessage.type) {
			case MESSAGE_TYPE.PUBLISH:
				if (wireMessage.pubRecReceived) storedMessage.pubRecReceived = true;
				storedMessage.payloadMessage = {};
				var hex = "";
				var messageBytes = wireMessage.payloadMessage.payloadBytes;
				for (var i = 0; i < messageBytes.length; i++) {
					if (messageBytes[i] <= 15) hex = hex + "0" + messageBytes[i].toString(16);
					else hex = hex + messageBytes[i].toString(16)
				}
				storedMessage.payloadMessage.payloadHex = hex;
				storedMessage.payloadMessage.qos = wireMessage.payloadMessage.qos;
				storedMessage.payloadMessage.destinationName = wireMessage.payloadMessage.destinationName;
				if (wireMessage.payloadMessage.duplicate) storedMessage.payloadMessage.duplicate = true;
				if (wireMessage.payloadMessage.retained) storedMessage.payloadMessage.retained = true;
				if (prefix.indexOf("Sent:") == 0) {
					if (wireMessage.sequence === undefined) wireMessage.sequence = ++this._sequence;
					storedMessage.sequence = wireMessage.sequence
				}
				break;
			default:
				throw Error(format(ERROR.INVALID_STORED_DATA, [key, storedMessage]))
		}
		localStorage.setItem(prefix + this._localKey + wireMessage.messageIdentifier, JSON.stringify(storedMessage))
	};
	ClientImpl.prototype.restore = function(key) {
		var value = localStorage.getItem(key);
		var storedMessage = JSON.parse(value);
		var wireMessage = new WireMessage(storedMessage.type, storedMessage);
		switch (storedMessage.type) {
			case MESSAGE_TYPE.PUBLISH:
				var hex = storedMessage.payloadMessage.payloadHex;
				var buffer = new ArrayBuffer(hex.length / 2);
				var byteStream = new Uint8Array(buffer);
				var i = 0;
				while (hex.length >= 2) {
					var x = parseInt(hex.substring(0, 2), 16);
					hex = hex.substring(2, hex.length);
					byteStream[i++] = x
				}
				var payloadMessage = new Paho.MQTT.Message(byteStream);
				payloadMessage.qos = storedMessage.payloadMessage.qos;
				payloadMessage.destinationName = storedMessage.payloadMessage.destinationName;
				if (storedMessage.payloadMessage.duplicate) payloadMessage.duplicate = true;
				if (storedMessage.payloadMessage.retained) payloadMessage.retained = true;
				wireMessage.payloadMessage = payloadMessage;
				break;
			default:
				throw Error(format(ERROR.INVALID_STORED_DATA, [key, value]))
		}
		if (key.indexOf("Sent:" + this._localKey) == 0) {
			wireMessage.payloadMessage.duplicate = true;
			this._sentMessages[wireMessage.messageIdentifier] = wireMessage
		} else if (key.indexOf("Received:" + this._localKey) == 0) {
			this._receivedMessages[wireMessage.messageIdentifier] = wireMessage
		}
	};
	ClientImpl.prototype._process_queue = function() {
		var message = null;
		var fifo = this._msg_queue.reverse();
		while (message = fifo.pop()) {
			this._socket_send(message);
			if (this._notify_msg_sent[message]) {
				this._notify_msg_sent[message]();
				delete this._notify_msg_sent[message]
			}
		}
	};
	ClientImpl.prototype._requires_ack = function(wireMessage) {
		var messageCount = Object.keys(this._sentMessages).length;
		if (messageCount > this.maxMessageIdentifier) throw Error("Too many messages:" + messageCount);
		while (this._sentMessages[this._message_identifier] !== undefined) {
			this._message_identifier++
		}
		wireMessage.messageIdentifier = this._message_identifier;
		this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
		if (wireMessage.type === MESSAGE_TYPE.PUBLISH) {
			this.store("Sent:", wireMessage)
		}
		if (this._message_identifier === this.maxMessageIdentifier) {
			this._message_identifier = 1
		}
	};
	ClientImpl.prototype._on_socket_open = function() {
		var wireMessage = new WireMessage(MESSAGE_TYPE.CONNECT, this.connectOptions);
		wireMessage.clientId = this.clientId;
		this._socket_send(wireMessage)
	};
	ClientImpl.prototype._on_socket_message = function(event) {
		this._trace("Client._on_socket_message", event.data);
		this.receivePinger.reset();
		var messages = this._deframeMessages(event.data);
		for (var i = 0; i < messages.length; i += 1) {
			this._handleMessage(messages[i])
		}
	};
	ClientImpl.prototype._deframeMessages = function(data) {
		var byteArray = new Uint8Array(data);
		if (this.receiveBuffer) {
			var newData = new Uint8Array(this.receiveBuffer.length + byteArray.length);
			newData.set(this.receiveBuffer);
			newData.set(byteArray, this.receiveBuffer.length);
			byteArray = newData;
			delete this.receiveBuffer
		}
		try {
			var offset = 0;
			var messages = [];
			while (offset < byteArray.length) {
				var result = decodeMessage(byteArray, offset);
				var wireMessage = result[0];
				offset = result[1];
				if (wireMessage !== null) {
					messages.push(wireMessage)
				} else {
					break
				}
			}
			if (offset < byteArray.length) {
				this.receiveBuffer = byteArray.subarray(offset)
			}
		} catch (error) {
			this._disconnected(ERROR.INTERNAL_ERROR.code, format(ERROR.INTERNAL_ERROR, [error.message, error.stack.toString()]));
			return
		}
		return messages
	};
	ClientImpl.prototype._handleMessage = function(wireMessage) {
		this._trace("Client._handleMessage", wireMessage);
		try {
			switch (wireMessage.type) {
				case MESSAGE_TYPE.CONNACK:
					this._connectTimeout.cancel();
					if (this.connectOptions.cleanSession) {
						for (var key in this._sentMessages) {
							var sentMessage = this._sentMessages[key];
							localStorage.removeItem("Sent:" + this._localKey + sentMessage.messageIdentifier)
						}
						this._sentMessages = {};
						for (var key in this._receivedMessages) {
							var receivedMessage = this._receivedMessages[key];
							localStorage.removeItem("Received:" + this._localKey + receivedMessage.messageIdentifier)
						}
						this._receivedMessages = {}
					}
					if (wireMessage.returnCode === 0) {
						this.connected = true;
						if (this.connectOptions.uris) this.hostIndex = this.connectOptions.uris.length
					} else {
						this._disconnected(ERROR.CONNACK_RETURNCODE.code, format(ERROR.CONNACK_RETURNCODE, [wireMessage.returnCode, CONNACK_RC[wireMessage.returnCode]]));
						break
					}
					var sequencedMessages = new Array;
					for (var msgId in this._sentMessages) {
						if (this._sentMessages.hasOwnProperty(msgId)) sequencedMessages.push(this._sentMessages[msgId])
					}
					var sequencedMessages = sequencedMessages.sort(function(a, b) {
						return a.sequence - b.sequence
					});
					for (var i = 0, len = sequencedMessages.length; i < len; i++) {
						var sentMessage = sequencedMessages[i];
						if (sentMessage.type == MESSAGE_TYPE.PUBLISH && sentMessage.pubRecReceived) {
							var pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {
								messageIdentifier: sentMessage.messageIdentifier
							});
							this._schedule_message(pubRelMessage)
						} else {
							this._schedule_message(sentMessage)
						}
					}
					if (this.connectOptions.onSuccess) {
						this.connectOptions.onSuccess({
							invocationContext: this.connectOptions.invocationContext
						})
					}
					this._process_queue();
					break;
				case MESSAGE_TYPE.PUBLISH:
					this._receivePublish(wireMessage);
					break;
				case MESSAGE_TYPE.PUBACK:
					var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
					if (sentMessage) {
						delete this._sentMessages[wireMessage.messageIdentifier];
						localStorage.removeItem("Sent:" + this._localKey + wireMessage.messageIdentifier);
						if (this.onMessageDelivered) this.onMessageDelivered(sentMessage.payloadMessage)
					}
					break;
				case MESSAGE_TYPE.PUBREC:
					var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
					if (sentMessage) {
						sentMessage.pubRecReceived = true;
						var pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {
							messageIdentifier: wireMessage.messageIdentifier
						});
						this.store("Sent:", sentMessage);
						this._schedule_message(pubRelMessage)
					}
					break;
				case MESSAGE_TYPE.PUBREL:
					var receivedMessage = this._receivedMessages[wireMessage.messageIdentifier];
					localStorage.removeItem("Received:" + this._localKey + wireMessage.messageIdentifier);
					if (receivedMessage) {
						this._receiveMessage(receivedMessage);
						delete this._receivedMessages[wireMessage.messageIdentifier]
					}
					var pubCompMessage = new WireMessage(MESSAGE_TYPE.PUBCOMP, {
						messageIdentifier: wireMessage.messageIdentifier
					});
					this._schedule_message(pubCompMessage);
					break;
				case MESSAGE_TYPE.PUBCOMP:
					var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
					delete this._sentMessages[wireMessage.messageIdentifier];
					localStorage.removeItem("Sent:" + this._localKey + wireMessage.messageIdentifier);
					if (this.onMessageDelivered) this.onMessageDelivered(sentMessage.payloadMessage);
					break;
				case MESSAGE_TYPE.SUBACK:
					var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
					if (sentMessage) {
						if (sentMessage.timeOut) sentMessage.timeOut.cancel();
						if (wireMessage.returnCode[0] === 128) {
							if (sentMessage.onFailure) {
								sentMessage.onFailure(wireMessage.returnCode)
							}
						} else if (sentMessage.onSuccess) {
							sentMessage.onSuccess(wireMessage.returnCode)
						}
						delete this._sentMessages[wireMessage.messageIdentifier]
					}
					break;
				case MESSAGE_TYPE.UNSUBACK:
					var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
					if (sentMessage) {
						if (sentMessage.timeOut) sentMessage.timeOut.cancel();
						if (sentMessage.callback) {
							sentMessage.callback()
						}
						delete this._sentMessages[wireMessage.messageIdentifier]
					}
					break;
				case MESSAGE_TYPE.PINGRESP:
					this.sendPinger.reset();
					break;
				case MESSAGE_TYPE.DISCONNECT:
					this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code, format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]));
					break;
				default:
					this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code, format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]))
			}
		} catch (error) {
			this._disconnected(ERROR.INTERNAL_ERROR.code, format(ERROR.INTERNAL_ERROR, [error.message, error.stack.toString()]));
			return
		}
	};
	ClientImpl.prototype._on_socket_error = function(error) {
		this._disconnected(ERROR.SOCKET_ERROR.code, format(ERROR.SOCKET_ERROR, [error.data]))
	};
	ClientImpl.prototype._on_socket_close = function() {
		this._disconnected(ERROR.SOCKET_CLOSE.code, format(ERROR.SOCKET_CLOSE))
	};
	ClientImpl.prototype._socket_send = function(wireMessage) {
		if (wireMessage.type == 1) {
			var wireMessageMasked = this._traceMask(wireMessage, "password");
			this._trace("Client._socket_send", wireMessageMasked)
		} else this._trace("Client._socket_send", wireMessage);
		this.socket.send(wireMessage.encode());
		this.sendPinger.reset()
	};
	ClientImpl.prototype._receivePublish = function(wireMessage) {
		switch (wireMessage.payloadMessage.qos) {
			case "undefined":
			case 0:
				this._receiveMessage(wireMessage);
				break;
			case 1:
				var pubAckMessage = new WireMessage(MESSAGE_TYPE.PUBACK, {
					messageIdentifier: wireMessage.messageIdentifier
				});
				this._schedule_message(pubAckMessage);
				this._receiveMessage(wireMessage);
				break;
			case 2:
				this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
				this.store("Received:", wireMessage);
				var pubRecMessage = new WireMessage(MESSAGE_TYPE.PUBREC, {
					messageIdentifier: wireMessage.messageIdentifier
				});
				this._schedule_message(pubRecMessage);
				break;
			default:
				throw Error("Invaild qos=" + wireMmessage.payloadMessage.qos)
		}
	};
	ClientImpl.prototype._receiveMessage = function(wireMessage) {
		if (this.onMessageArrived) {
			this.onMessageArrived(wireMessage.payloadMessage)
		}
	};
	ClientImpl.prototype._disconnected = function(errorCode, errorText) {
		this._trace("Client._disconnected", errorCode, errorText);
		this.sendPinger.cancel();
		this.receivePinger.cancel();
		if (this._connectTimeout) this._connectTimeout.cancel();
		this._msg_queue = [];
		this._notify_msg_sent = {};
		if (this.socket) {
			this.socket.onopen = null;
			this.socket.onmessage = null;
			this.socket.onerror = null;
			this.socket.onclose = null;
			if (this.socket.readyState === 1) this.socket.close();
			delete this.socket
		}
		if (this.connectOptions.uris && this.hostIndex < this.connectOptions.uris.length - 1) {
			this.hostIndex++;
			this._doConnect(this.connectOptions.uris[this.hostIndex])
		} else {
			if (errorCode === undefined) {
				errorCode = ERROR.OK.code;
				errorText = format(ERROR.OK)
			}
			if (this.connected) {
				this.connected = false;
				if (this.onConnectionLost) this.onConnectionLost({
					errorCode: errorCode,
					errorMessage: errorText
				})
			} else {
				if (this.connectOptions.mqttVersion === 4 && this.connectOptions.mqttVersionExplicit === false) {
					this._trace("Failed to connect V4, dropping back to V3");
					this.connectOptions.mqttVersion = 3;
					if (this.connectOptions.uris) {
						this.hostIndex = 0;
						this._doConnect(this.connectOptions.uris[0])
					} else {
						this._doConnect(this.uri)
					}
				} else if (this.connectOptions.onFailure) {
					this.connectOptions.onFailure({
						invocationContext: this.connectOptions.invocationContext,
						errorCode: errorCode,
						errorMessage: errorText
					})
				}
			}
		}
	};
	ClientImpl.prototype._trace = function() {
		if (this.traceFunction) {
			for (var i in arguments) {
				if (typeof arguments[i] !== "undefined") arguments[i] = JSON.stringify(arguments[i])
			}
			var record = Array.prototype.slice.call(arguments).join("");
			this.traceFunction({
				severity: "Debug",
				message: record
			})
		}
		if (this._traceBuffer !== null) {
			for (var i = 0, max = arguments.length; i < max; i++) {
				if (this._traceBuffer.length == this._MAX_TRACE_ENTRIES) {
					this._traceBuffer.shift()
				}
				if (i === 0) this._traceBuffer.push(arguments[i]);
				else if (typeof arguments[i] === "undefined") this._traceBuffer.push(arguments[i]);
				else this._traceBuffer.push("  " + JSON.stringify(arguments[i]))
			}
		}
	};
	ClientImpl.prototype._traceMask = function(traceObject, masked) {
		var traceObjectMasked = {};
		for (var attr in traceObject) {
			if (traceObject.hasOwnProperty(attr)) {
				if (attr == masked) traceObjectMasked[attr] = "******";
				else traceObjectMasked[attr] = traceObject[attr]
			}
		}
		return traceObjectMasked
	};
	var Client = function(host, port, path, clientId) {
		var uri;
		if (typeof host !== "string") throw new Error(format(ERROR.INVALID_TYPE, [typeof host, "host"]));
		if (arguments.length == 2) {
			clientId = port;
			uri = host;
			var match = uri.match(/^(wss?):\/\/((\[(.+)\])|([^\/]+?))(:(\d+))?(\/.*)$/);
			if (match) {
				host = match[4] || match[2];
				port = parseInt(match[7]);
				path = match[8]
			} else {
				throw new Error(format(ERROR.INVALID_ARGUMENT, [host, "host"]))
			}
		} else {
			if (arguments.length == 3) {
				clientId = path;
				path = "/mqtt"
			}
			if (typeof port !== "number" || port < 0) throw new Error(format(ERROR.INVALID_TYPE, [typeof port, "port"]));
			if (typeof path !== "string") throw new Error(format(ERROR.INVALID_TYPE, [typeof path, "path"]));
			var ipv6AddSBracket = host.indexOf(":") != -1 && host.slice(0, 1) != "[" && host.slice(-1) != "]";
			uri = "ws://" + (ipv6AddSBracket ? "[" + host + "]" : host) + ":" + port + path
		}
		var clientIdLength = 0;
		for (var i = 0; i < clientId.length; i++) {
			var charCode = clientId.charCodeAt(i);
			if (55296 <= charCode && charCode <= 56319) {
				i++
			}
			clientIdLength++
		}
		if (typeof clientId !== "string" || clientIdLength > 65535) throw new Error(format(ERROR.INVALID_ARGUMENT, [clientId, "clientId"]));
		var client = new ClientImpl(uri, host, port, path, clientId);
		this._getHost = function() {
			return host
		};
		this._setHost = function() {
			throw new Error(format(ERROR.UNSUPPORTED_OPERATION))
		};
		this._getPort = function() {
			return port
		};
		this._setPort = function() {
			throw new Error(format(ERROR.UNSUPPORTED_OPERATION))
		};
		this._getPath = function() {
			return path
		};
		this._setPath = function() {
			throw new Error(format(ERROR.UNSUPPORTED_OPERATION))
		};
		this._getURI = function() {
			return uri
		};
		this._setURI = function() {
			throw new Error(format(ERROR.UNSUPPORTED_OPERATION))
		};
		this._getClientId = function() {
			return client.clientId
		};
		this._setClientId = function() {
			throw new Error(format(ERROR.UNSUPPORTED_OPERATION))
		};
		this._getOnConnectionLost = function() {
			return client.onConnectionLost
		};
		this._setOnConnectionLost = function(newOnConnectionLost) {
			if (typeof newOnConnectionLost === "function") client.onConnectionLost = newOnConnectionLost;
			else throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnConnectionLost, "onConnectionLost"]))
		};
		this._getOnMessageDelivered = function() {
			return client.onMessageDelivered
		};
		this._setOnMessageDelivered = function(newOnMessageDelivered) {
			if (typeof newOnMessageDelivered === "function") client.onMessageDelivered = newOnMessageDelivered;
			else throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnMessageDelivered, "onMessageDelivered"]))
		};
		this._getOnMessageArrived = function() {
			return client.onMessageArrived
		};
		this._setOnMessageArrived = function(newOnMessageArrived) {
			if (typeof newOnMessageArrived === "function") client.onMessageArrived = newOnMessageArrived;
			else throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnMessageArrived, "onMessageArrived"]))
		};
		this._getTrace = function() {
			return client.traceFunction
		};
		this._setTrace = function(trace) {
			if (typeof trace === "function") {
				client.traceFunction = trace
			} else {
				throw new Error(format(ERROR.INVALID_TYPE, [typeof trace, "onTrace"]))
			}
		};
		this.connect = function(connectOptions) {
			connectOptions = connectOptions || {};
			validate(connectOptions, {
				timeout: "number",
				userName: "string",
				password: "string",
				willMessage: "object",
				keepAliveInterval: "number",
				cleanSession: "boolean",
				useSSL: "boolean",
				invocationContext: "object",
				onSuccess: "function",
				onFailure: "function",
				hosts: "object",
				ports: "object",
				mqttVersion: "number"
			});
			if (connectOptions.keepAliveInterval === undefined) connectOptions.keepAliveInterval = 60;
			if (connectOptions.mqttVersion > 4 || connectOptions.mqttVersion < 3) {
				throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.mqttVersion, "connectOptions.mqttVersion"]))
			}
			if (connectOptions.mqttVersion === undefined) {
				connectOptions.mqttVersionExplicit = false;
				connectOptions.mqttVersion = 4
			} else {
				connectOptions.mqttVersionExplicit = true
			} if (connectOptions.password === undefined && connectOptions.userName !== undefined) throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.password, "connectOptions.password"]));
			if (connectOptions.willMessage) {
				if (!(connectOptions.willMessage instanceof Message)) throw new Error(format(ERROR.INVALID_TYPE, [connectOptions.willMessage, "connectOptions.willMessage"]));
				connectOptions.willMessage.stringPayload;
				if (typeof connectOptions.willMessage.destinationName === "undefined") throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.willMessage.destinationName, "connectOptions.willMessage.destinationName"]))
			}
			if (typeof connectOptions.cleanSession === "undefined") connectOptions.cleanSession = true;
			if (connectOptions.hosts) {
				if (!(connectOptions.hosts instanceof Array)) throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts, "connectOptions.hosts"]));
				if (connectOptions.hosts.length < 1) throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts, "connectOptions.hosts"]));
				var usingURIs = false;
				for (var i = 0; i < connectOptions.hosts.length; i++) {
					if (typeof connectOptions.hosts[i] !== "string") throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.hosts[i], "connectOptions.hosts[" + i + "]"]));
					if (/^(wss?):\/\/((\[(.+)\])|([^\/]+?))(:(\d+))?(\/.*)$/.test(connectOptions.hosts[i])) {
						if (i == 0) {
							usingURIs = true
						} else if (!usingURIs) {
							throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts[i], "connectOptions.hosts[" + i + "]"]))
						}
					} else if (usingURIs) {
						throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts[i], "connectOptions.hosts[" + i + "]"]))
					}
				}
				if (!usingURIs) {
					if (!connectOptions.ports) throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, "connectOptions.ports"]));
					if (!(connectOptions.ports instanceof Array)) throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, "connectOptions.ports"]));
					if (connectOptions.hosts.length != connectOptions.ports.length) throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, "connectOptions.ports"]));
					connectOptions.uris = [];
					for (var i = 0; i < connectOptions.hosts.length; i++) {
						if (typeof connectOptions.ports[i] !== "number" || connectOptions.ports[i] < 0) throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.ports[i], "connectOptions.ports[" + i + "]"]));
						var host = connectOptions.hosts[i];
						var port = connectOptions.ports[i];
						var ipv6 = host.indexOf(":") != -1;
						uri = "ws://" + (ipv6 ? "[" + host + "]" : host) + ":" + port + path;
						connectOptions.uris.push(uri)
					}
				} else {
					connectOptions.uris = connectOptions.hosts
				}
			}
			client.connect(connectOptions)
		};
		this.subscribe = function(filter, subscribeOptions) {
			if (typeof filter !== "string") throw new Error("Invalid argument:" + filter);
			subscribeOptions = subscribeOptions || {};
			validate(subscribeOptions, {
				qos: "number",
				invocationContext: "object",
				onSuccess: "function",
				onFailure: "function",
				timeout: "number"
			});
			if (subscribeOptions.timeout && !subscribeOptions.onFailure) throw new Error("subscribeOptions.timeout specified with no onFailure callback.");
			if (typeof subscribeOptions.qos !== "undefined" && !(subscribeOptions.qos === 0 || subscribeOptions.qos === 1 || subscribeOptions.qos === 2)) throw new Error(format(ERROR.INVALID_ARGUMENT, [subscribeOptions.qos, "subscribeOptions.qos"]));
			client.subscribe(filter, subscribeOptions)
		};
		this.unsubscribe = function(filter, unsubscribeOptions) {
			if (typeof filter !== "string") throw new Error("Invalid argument:" + filter);
			unsubscribeOptions = unsubscribeOptions || {};
			validate(unsubscribeOptions, {
				invocationContext: "object",
				onSuccess: "function",
				onFailure: "function",
				timeout: "number"
			});
			if (unsubscribeOptions.timeout && !unsubscribeOptions.onFailure) throw new Error("unsubscribeOptions.timeout specified with no onFailure callback.");
			client.unsubscribe(filter, unsubscribeOptions)
		};
		this.send = function(topic, payload, qos, retained) {
			var message;
			if (arguments.length == 0) {
				throw new Error("Invalid argument." + "length")
			} else if (arguments.length == 1) {
				if (!(topic instanceof Message) && typeof topic !== "string") throw new Error("Invalid argument:" + typeof topic);
				message = topic;
				if (typeof message.destinationName === "undefined") throw new Error(format(ERROR.INVALID_ARGUMENT, [message.destinationName, "Message.destinationName"]));
				client.send(message)
			} else {
				message = new Message(payload);
				message.destinationName = topic;
				if (arguments.length >= 3) message.qos = qos;
				if (arguments.length >= 4) message.retained = retained;
				client.send(message)
			}
		};
		this.disconnect = function() {
			client.disconnect()
		};
		this.getTraceLog = function() {
			return client.getTraceLog()
		};
		this.startTrace = function() {
			client.startTrace()
		};
		this.stopTrace = function() {
			client.stopTrace()
		};
		this.isConnected = function() {
			return client.connected
		}
	};
	Client.prototype = {
		get host() {
			return this._getHost()
		}, set host(newHost) {
			this._setHost(newHost)
		}, get port() {
			return this._getPort()
		}, set port(newPort) {
			this._setPort(newPort)
		}, get path() {
			return this._getPath()
		}, set path(newPath) {
			this._setPath(newPath)
		}, get clientId() {
			return this._getClientId()
		}, set clientId(newClientId) {
			this._setClientId(newClientId)
		}, get onConnectionLost() {
			return this._getOnConnectionLost()
		}, set onConnectionLost(newOnConnectionLost) {
			this._setOnConnectionLost(newOnConnectionLost)
		}, get onMessageDelivered() {
			return this._getOnMessageDelivered()
		}, set onMessageDelivered(newOnMessageDelivered) {
			this._setOnMessageDelivered(newOnMessageDelivered)
		}, get onMessageArrived() {
			return this._getOnMessageArrived()
		}, set onMessageArrived(newOnMessageArrived) {
			this._setOnMessageArrived(newOnMessageArrived)
		}, get trace() {
			return this._getTrace()
		}, set trace(newTraceFunction) {
			this._setTrace(newTraceFunction)
		}
	};
	var Message = function(newPayload) {
		var payload;
		if (typeof newPayload === "string" || newPayload instanceof ArrayBuffer || newPayload instanceof Int8Array || newPayload instanceof Uint8Array || newPayload instanceof Int16Array || newPayload instanceof Uint16Array || newPayload instanceof Int32Array || newPayload instanceof Uint32Array || newPayload instanceof Float32Array || newPayload instanceof Float64Array) {
			payload = newPayload
		} else {
			throw format(ERROR.INVALID_ARGUMENT, [newPayload, "newPayload"])
		}
		this._getPayloadString = function() {
			if (typeof payload === "string") return payload;
			else return parseUTF8(payload, 0, payload.length)
		};
		this._getPayloadBytes = function() {
			if (typeof payload === "string") {
				var buffer = new ArrayBuffer(UTF8Length(payload));
				var byteStream = new Uint8Array(buffer);
				stringToUTF8(payload, byteStream, 0);
				return byteStream
			} else {
				return payload
			}
		};
		var destinationName = undefined;
		this._getDestinationName = function() {
			return destinationName
		};
		this._setDestinationName = function(newDestinationName) {
			if (typeof newDestinationName === "string") destinationName = newDestinationName;
			else throw new Error(format(ERROR.INVALID_ARGUMENT, [newDestinationName, "newDestinationName"]))
		};
		var qos = 0;
		this._getQos = function() {
			return qos
		};
		this._setQos = function(newQos) {
			if (newQos === 0 || newQos === 1 || newQos === 2) qos = newQos;
			else throw new Error("Invalid argument:" + newQos)
		};
		var retained = false;
		this._getRetained = function() {
			return retained
		};
		this._setRetained = function(newRetained) {
			if (typeof newRetained === "boolean") retained = newRetained;
			else throw new Error(format(ERROR.INVALID_ARGUMENT, [newRetained, "newRetained"]))
		};
		var duplicate = false;
		this._getDuplicate = function() {
			return duplicate
		};
		this._setDuplicate = function(newDuplicate) {
			duplicate = newDuplicate
		}
	};
	Message.prototype = {
		get payloadString() {
			return this._getPayloadString()
		}, get payloadBytes() {
			return this._getPayloadBytes()
		}, get destinationName() {
			return this._getDestinationName()
		}, set destinationName(newDestinationName) {
			this._setDestinationName(newDestinationName)
		}, get qos() {
			return this._getQos()
		}, set qos(newQos) {
			this._setQos(newQos)
		}, get retained() {
			return this._getRetained()
		}, set retained(newRetained) {
			this._setRetained(newRetained)
		}, get duplicate() {
			return this._getDuplicate()
		}, set duplicate(newDuplicate) {
			this._setDuplicate(newDuplicate)
		}
	};
	return {
		Client: Client,
		Message: Message
	}
}(window);
var MqttClient = function(args) {
	var slice = Array.prototype.slice;
	var compact = function(obj) {
		return JSON.parse(JSON.stringify(obj))
	};
	var createMessage = function(topic, payload, qos, retain) {
		var message = new Paho.MQTT.Message(payload);
		message.destinationName = topic;
		message.qos = Number(qos) || 0;
		message.retained = !! retain;
		return message
	};
	var self = this;
	self.connected = false;
	self.broker = compact({
		host: args.host,
		port: Number(args.port),
		clientId: args.clientId || "client-" + Math.random().toString(36).slice(-6)
	});
	self.options = compact({
		timeout: Number(args.timeout) || 10,
		keepAliveInterval: Number(args.keepalive) || 30,
		mqttVersion: args.mqttVersion || undefined,
		userName: args.username || undefined,
		password: args.password || undefined,
		useSSL: args.ssl !== undefined ? args.ssl : false,
		cleanSession: args.clean !== undefined ? args.clean : true,
		willMessage: args.will && args.will.topic.length ? args.will : undefined
	});
	self.reconnect = args.reconnect;
	self.emitter = {
		events: {},
		bind: function(event, func) {
			self.emitter.events[event] = self.emitter.events[event] || [];
			self.emitter.events[event].push(func);
			return self
		},
		unbind: function(event, func) {
			if (event in self.emitter.events) self.emitter.events[event].splice(self.emitter.events[event].indexOf(func), 1);
			return self
		},
		trigger: function(event) {
			if (event in self.emitter.events) {
				for (var i = 0; i < self.emitter.events[event].length; ++i) {
					try {
						self.emitter.events[event][i].apply(self, slice.call(arguments, 1))
					} catch (e) {
						setTimeout(function() {
							throw e
						})
					}
				}
			}
		}
	};
	self.on = self.emitter.bind;
	self.bind = self.emitter.bind;
	self.unbind = self.emitter.unbind;
	self.once = function(event, func) {
		self.on(event, function handle() {
			func.apply(self, slice.call(arguments));
			self.unbind(event, handle)
		});
		return self
	};
	self.convertTopic = function(topic) {
		return new RegExp("^" + topic.replace(/\+/g, "[^/]+").replace(/#/g, ".+") + "$")
	};
	self.messages = {
		func: [],
		bind: function(topic, qos, callback) {
			if (arguments.length === 2 && typeof qos === "function") callback = qos;
			callback.topic = topic;
			callback.re = self.convertTopic(topic);
			callback.qos = Number(qos) || 0;
			self.messages.func.push(callback);
			return self
		},
		unbind: function(callback) {
			var index = self.messages.func.indexOf(callback);
			if (index > -1) {
				self.messages.func.splice(index, 1)
			}
			return self
		},
		trigger: function(topic) {
			var args = slice.call(arguments, 1);
			self.messages.func.forEach(function(fn) {
				if (fn.re.test(topic)) {
					fn.apply(self, args)
				}
			})
		}
	};
	self.messages.on = self.messages.bind;
	self.on("message", self.messages.trigger);
	self.client = new Paho.MQTT.Client(self.broker.host, self.broker.port, self.broker.clientId);
	self.client.onConnectionLost = self.emitter.trigger.bind(self, "disconnect");
	self.messageCache = [];
	self.client.onMessageDelivered = function(msg) {
		if (self.messageCache.indexOf(msg) >= 0) self.messageCache.splice(self.messageCache.indexOf(msg))[0].callback()
	};
	self.client.onMessageArrived = function(msg) {
		self.emitter.trigger("message", msg.destinationName, msg.payloadString || msg.payloadBytes, {
			topic: msg.destinationName,
			qos: msg.qos,
			retained: msg.retained,
			payload: msg.payloadBytes,
			duplicate: msg.duplicate
		})
	};

	function onDisconnect() {
		self.connected = false;
		if (self.reconnect) {
			setTimeout(function() {
				self.unbind("disconnect", onDisconnect);
				self.connect()
			}, self.reconnect)
		} else {
			self.emitter.trigger("offline")
		}
	}
	self.connect = function() {
		self.once("connect", function() {
			self.connected = true
		});
		self.once("disconnect", onDisconnect);
		var config = compact(self.options);
		config.onSuccess = self.emitter.trigger.bind(self, "connect");
		config.onFailure = self.emitter.trigger.bind(self, "disconnect");
		if (config.willMessage) {
			config.willMessage = createMessage(config.willMessage.topic, config.willMessage.payload, config.willMessage.qos, config.willMessage.retain)
		}
		self.client.connect(config);
		self.emitter.trigger("connecting");
		return self
	};
	self.disconnect = function() {
		self.unbind("disconnect", onDisconnect);
		self.client.disconnect();
		self.emitter.trigger("disconnect");
		self.emitter.trigger("offline")
	};
	self.subscribe = function(topic, qos, callback) {
		if (arguments.length === 2 && typeof arguments[1] === "function") callback = qos;
		self.client.subscribe(topic, callback ? {
			qos: Number(qos) || 0,
			timeout: 15,
			onSuccess: function(granted) {
				callback.call(self, undefined, granted.grantedQos[0])
			},
			onFailure: callback.bind(self)
		} : {})
	};
	self.unsubscribe = function(topic, callback) {
		self.client.unsubscribe(topic, callback ? {
			timeout: 15,
			onSuccess: callback.bind(self, undefined),
			onFailure: callback.bind(self)
		} : {})
	};
	self.publish = function(topic, payload, options, callback) {
		var message = createMessage(topic, payload, options && options.qos, options && options.retain);
		if (callback) {
			if (message.qos < 1) {
				setTimeout(callback)
			} else {
				message.callback = callback;
				self.messageCache.push(message)
			}
		}
		self.client.send(message)
	};
	return self
};
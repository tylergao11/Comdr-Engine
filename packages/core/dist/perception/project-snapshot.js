"use strict";
// ============================================================
// ProjectSnapshot — 项目感知数据模型 + 收集
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_SNAPSHOT = void 0;
exports.buildFromAssetsProbe = buildFromAssetsProbe;
exports.buildFromScriptsProbe = buildFromScriptsProbe;
exports.buildNodeEntriesFromCtx = buildNodeEntriesFromCtx;
exports.findNodeByName = findNodeByName;
exports.collectNodeNames = collectNodeNames;
exports.EMPTY_SNAPSHOT = {
    openDocument: { kind: 'none', path: '', nodes: [] },
    prefabs: [],
    scenes: [],
    scripts: [],
    resources: [],
    collectedAt: '',
};
// ===== 从 Bridge probe 结果构建 Snapshot =====
/** 从 assets probe 结果提取 prefab/scene/resource 列表 */
function buildFromAssetsProbe(data) {
    const prefabs = [];
    const scenes = [];
    const resources = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            if (!item || typeof item !== 'object')
                continue;
            const rec = item;
            const assetPath = (rec.path || rec.url || '');
            const uuid = (rec.uuid || '');
            const type = (rec.type || '');
            if (assetPath.endsWith('.prefab')) {
                prefabs.push({ path: assetPath, rootName: rec.name || '' });
            }
            else if (assetPath.endsWith('.scene') || type === 'scene') {
                scenes.push({ path: assetPath });
            }
            else if (uuid && assetPath) {
                resources.push({ path: assetPath, uuid, type });
            }
        }
    }
    return { prefabs, scenes, resources };
}
/** 从 scripts probe 结果提取脚本列表 */
function buildFromScriptsProbe(data) {
    const scripts = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            if (!item || typeof item !== 'object')
                continue;
            const rec = item;
            scripts.push({
                className: (rec.className || rec.name || ''),
                path: (rec.path || rec.url || ''),
            });
        }
    }
    return scripts;
}
/** 从 ctx() probe 结果的字符串摘要解析节点信息（受限于 Commander 返回的摘要文本） */
function buildNodeEntriesFromCtx(data) {
    // ctx() 返回的是节点树摘要文本，格式不定。这里提供一个基础解析器。
    // 如果 data 是对象（有 _children），直接递归解析
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const rec = data;
        return [parseNodeTree(rec)];
    }
    return [];
}
function parseNodeTree(node) {
    const components = [];
    const comps = node._components;
    if (Array.isArray(comps)) {
        for (const c of comps) {
            if (c && typeof c === 'object') {
                const compType = c.__type__;
                if (compType)
                    components.push(compType);
            }
        }
    }
    const children = [];
    const childNodes = node._children;
    if (Array.isArray(childNodes)) {
        for (const c of childNodes) {
            if (c && typeof c === 'object') {
                children.push(parseNodeTree(c));
            }
        }
    }
    return {
        name: node._name || '',
        fileId: node._id || '',
        components,
        children,
    };
}
/** 在节点树中递归搜索匹配名字的节点 */
function findNodeByName(nodes, name) {
    const lower = name.toLowerCase();
    for (const node of nodes) {
        if (node.name.toLowerCase() === lower)
            return node;
        const found = findNodeByName(node.children, name);
        if (found)
            return found;
    }
    return null;
}
/** 在节点树中收集所有节点名（扁平列表） */
function collectNodeNames(nodes) {
    const names = [];
    for (const node of nodes) {
        names.push(node.name);
        names.push(...collectNodeNames(node.children));
    }
    return names;
}
//# sourceMappingURL=project-snapshot.js.map
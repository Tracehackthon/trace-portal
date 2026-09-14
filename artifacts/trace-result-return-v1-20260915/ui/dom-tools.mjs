// Adapted from the existing Trace chain UI helpers, not an external DOM framework.
export function patchDOM(parent, fresh, isComposing = () => false) {
  const desired = [...fresh.childNodes];
  desired.forEach((node, i) => {
    let old = parent.childNodes[i];
    const key = node.nodeType === 1 ? node.getAttribute('data-key') : null;
    if (key && (!old || old.nodeType !== 1 || old.getAttribute('data-key') !== key)) {
      const found = [...parent.childNodes].find(n => n.nodeType === 1 && n.getAttribute('data-key') === key);
      if (found) { parent.insertBefore(found, old || null); old = found; }
    }
    if (!old) { parent.append(node.cloneNode(true)); return; }
    if (node.nodeType !== old.nodeType || (node.nodeType === 1 && (node.tagName !== old.tagName || (key && old.getAttribute('data-key') !== key)))) {old.replaceWith(node.cloneNode(true));return;}
    if (node.nodeType === 3) {if(old.data!==node.data)old.data=node.data;return;}
    if (node.nodeType !== 1) return;
    for(const attr of [...old.attributes])if(!node.hasAttribute(attr.name))old.removeAttribute(attr.name);
    for(const attr of [...node.attributes])if(old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
    if(node.hasAttribute('data-preserve'))return;
    if(old.tagName==='TEXTAREA'||old.tagName==='INPUT') {
      if(old.value!==node.value&&!isComposing(old)) {
        const active=old.ownerDocument.activeElement===old,start=old.selectionStart,end=old.selectionEnd,direction=old.selectionDirection;
        old.value=node.value;
        if(active&&start!=null&&end!=null)old.setSelectionRange(Math.min(start,old.value.length),Math.min(end,old.value.length),direction);
      }
      if(old.tagName==='INPUT')old.checked=node.checked;
    } else {patchDOM(old,node,isComposing);if(old.tagName==='SELECT')old.value=node.value;}
  });
  while(parent.childNodes.length>desired.length)parent.lastChild.remove();
}
export function selectedRange(container) {
  if(!container)return null;
  const selection=container.ownerDocument.defaultView.getSelection();
  if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
  const range=selection.getRangeAt(0);
  if(!container.contains(range.startContainer)||!container.contains(range.endContainer))return null;
  const prefix=range.cloneRange();prefix.selectNodeContents(container);prefix.setEnd(range.startContainer,range.startOffset);
  return {start:prefix.toString().length,end:prefix.toString().length+range.toString().length,text:range.toString()};
}

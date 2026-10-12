import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';

function parse(path: string) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}
function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}
function apiObject(tree: ts.SourceFile, name: string): ts.ObjectLiteralExpression {
  let result: ts.ObjectLiteralExpression | undefined;
  walk(tree, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(tree) === name &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    )
      result = node.initializer;
  });
  if (!result) throw new Error(`Missing API object: ${name}`);
  return result;
}
it('connects every shared desktop method to preload and exactly one IPC handler or removable event', () => {
  const types = parse('src/lib/types.ts');
  const preload = parse('electron/preload.ts');
  const desktop = parse('src/lib/desktop.ts');
  const main = parse('electron/main.ts');
  let api: ts.InterfaceDeclaration | undefined;
  walk(types, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'DesktopApi') api = node;
  });
  if (!api) throw new Error('Missing DesktopApi');
  const typeNames = api.members.map((member) => member.name!.getText(types)).sort();
  const object = apiObject(preload, 'api');
  expect(object.properties.map((p) => p.name!.getText(preload)).sort()).toEqual(typeNames);
  expect(
    apiObject(desktop, 'desktop')
      .properties.map((p) => p.name!.getText(desktop))
      .sort(),
  ).toEqual(typeNames);
  const requests: string[] = [];
  const subscriptions: string[] = [];
  for (const property of object.properties) {
    const calls: string[] = [],
      events: string[] = [],
      removed: string[] = [];
    walk(property, (node) => {
      if (
        !ts.isCallExpression(node) ||
        !node.arguments[0] ||
        !ts.isStringLiteral(node.arguments[0])
      )
        return;
      const expression = node.expression.getText(preload),
        channel = node.arguments[0].text;
      if (expression === 'call') calls.push(channel);
      if (expression === 'ipcRenderer.on') events.push(channel);
      if (expression === 'ipcRenderer.removeListener') removed.push(channel);
    });
    expect(calls.length + events.length, property.name!.getText(preload)).toBe(1);
    expect(events).toEqual(removed);
    requests.push(...calls);
    subscriptions.push(...events);
  }
  const handlers: string[] = [],
    emitted: string[] = [];
  walk(main, (node) => {
    if (!ts.isCallExpression(node) || !node.arguments[0] || !ts.isStringLiteral(node.arguments[0]))
      return;
    const expression = node.expression.getText(main),
      channel = node.arguments[0].text;
    if (expression === 'handle') handlers.push(channel);
    if (expression.endsWith('.webContents.send')) emitted.push(channel);
  });
  expect(new Set(requests).size).toBe(requests.length);
  expect(requests.sort()).toEqual(handlers.sort());
  for (const channel of subscriptions) expect(emitted).toContain(channel);
  expect({
    methods: typeNames.length,
    requests: requests.length,
    events: subscriptions.length,
  }).toEqual({ methods: 88, requests: 82, events: 6 });
});

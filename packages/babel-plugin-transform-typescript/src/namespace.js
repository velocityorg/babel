const SHARED_NAMESPACE_ERRORS = {
  TSEnumDeclaration: "An enum may not share the name of its parent namespace.",
  FunctionDeclaration:
    "A function may not share the name of its parent namespace.",
  ClassDeclaration: "A class may not share the name of its parent namespace.",
  VariableDeclaration:
    "A variable may not share the name of its parent namespace.",
  TSModuleDeclaration:
    "A namespace may not share the name of its parent namespace.",
};

export default function transpileNamespace(path, t) {
  if (path.node.declare || path.node.id.type === "StringLiteral") {
    path.remove();
    return;
  }

  const name = path.node.id.name;
  const value = handleNested(path, t, JSON.parse(JSON.stringify(path.node)));
  const bound = path.scope.hasOwnBinding(name);
  if (path.parent.type === "ExportNamedDeclaration") {
    if (!bound) {
      path.parentPath.insertAfter(value);
      path.replaceWith(getDeclaration(t, name));
      path.scope.registerDeclaration(path.parentPath);
    } else {
      path.parentPath.replaceWith(value);
    }
  } else if (bound) {
    path.replaceWith(value);
  } else {
    path.scope.registerDeclaration(
      path.replaceWithMultiple([getDeclaration(t, name), value])[0],
    );
  }
}

function getDeclaration(t, name) {
  return t.variableDeclaration("let", [
    t.variableDeclarator(t.identifier(name)),
  ]);
}

function getMemberExpression(t, name, itemName) {
  return t.memberExpression(t.identifier(name), t.identifier(itemName));
}

function handleNested(path, t, node, parentExportName) {
  const names = [];
  const name = node.id.name;
  const namespaceTopLevel = node.body.body;
  for (let i = 0; i < namespaceTopLevel.length; i++) {
    const subNode = namespaceTopLevel[i];
    switch (subNode.type) {
      case "TSModuleDeclaration": {
        const moduleName = subNode.id.name;
        if (moduleName === name) {
          throw path.hub.file.buildCodeFrameError(
            subNode,
            SHARED_NAMESPACE_ERRORS.TSModuleDeclaration,
          );
        }
        if (names[moduleName]) {
          namespaceTopLevel[i] = handleNested(path, t, subNode);
        } else {
          names[moduleName] = true;
          namespaceTopLevel.splice(
            i++,
            1,
            getDeclaration(t, moduleName),
            handleNested(path, t, subNode),
          );
        }
        continue;
      }
      case "TSEnumDeclaration":
      case "FunctionDeclaration":
      case "ClassDeclaration": {
        const itemName = subNode.id.name;
        if (itemName === name) {
          throw path.hub.file.buildCodeFrameError(
            subNode,
            SHARED_NAMESPACE_ERRORS[subNode.type],
          );
        }
        names[itemName] = true;
        continue;
      }
      case "VariableDeclaration":
        for (const variable of subNode.declarations) {
          const variableName = variable.id.name;
          if (variableName === name) {
            throw path.hub.file.buildCodeFrameError(
              variable,
              SHARED_NAMESPACE_ERRORS.VariableDeclaration,
            );
          }
          names[variableName] = true;
        }
        continue;
      default:
        continue;
      case "ExportNamedDeclaration":
    }
    switch (subNode.declaration.type) {
      case "TSEnumDeclaration":
      case "FunctionDeclaration":
      case "ClassDeclaration": {
        const itemName = subNode.declaration.id.name;
        if (itemName === name) {
          throw path.hub.file.buildCodeFrameError(
            subNode.declaration,
            SHARED_NAMESPACE_ERRORS[subNode.declaration.type],
          );
        }
        names[itemName] = true;
        namespaceTopLevel.splice(
          i++,
          1,
          subNode.declaration,
          t.expressionStatement(
            t.assignmentExpression(
              "=",
              getMemberExpression(t, name, itemName),
              t.identifier(itemName),
            ),
          ),
        );
        break;
      }
      case "VariableDeclaration":
        if (subNode.declaration.kind !== "const") {
          throw path.hub.file.buildCodeFrameError(
            subNode.declaration,
            "Namespaces exporting non-const are unsupported.",
          );
        }
        for (const variable of subNode.declaration.declarations) {
          const variableName = variable.id.name;
          if (variableName === name) {
            throw path.hub.file.buildCodeFrameError(
              variable,
              SHARED_NAMESPACE_ERRORS.VariableDeclaration,
            );
          }
          variable.init = t.assignmentExpression(
            "=",
            getMemberExpression(t, name, variableName),
            variable.init,
          );
        }
        namespaceTopLevel[i] = subNode.declaration;
        break;
      case "TSModuleDeclaration": {
        const moduleName = subNode.declaration.id.name;
        if (moduleName === name) {
          throw path.hub.file.buildCodeFrameError(
            subNode.declaration,
            SHARED_NAMESPACE_ERRORS.TSModuleDeclaration,
          );
        }
        if (names[moduleName]) {
          namespaceTopLevel[i] = handleNested(
            path,
            t,
            subNode.declaration,
            name,
          );
        } else {
          names[moduleName] = true;
          namespaceTopLevel.splice(
            i++,
            1,
            getDeclaration(t, moduleName),
            handleNested(path, t, subNode.declaration, name),
          );
        }
      }
    }
  }

  const derivedParameter = t.logicalExpression(
    "||",
    t.identifier(name),
    t.assignmentExpression("=", t.identifier(name), t.objectExpression([])),
  );
  return t.expressionStatement(
    t.callExpression(
      t.functionExpression(
        null,
        [t.identifier(name)],
        t.blockStatement(namespaceTopLevel),
      ),
      [
        parentExportName
          ? t.assignmentExpression(
              "=",
              getMemberExpression(t, parentExportName, name),
              derivedParameter,
            )
          : derivedParameter,
      ],
    ),
  );
}

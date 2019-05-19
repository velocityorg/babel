export default function transpileNamespace(path, t) {
  if (path.node.declare || path.node.id.type === "StringLiteral") {
    path.remove();
    return;
  }

  const name = path.node.id.name;
  const value = handleNested(path, t, t.cloneDeep(path.node));
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
  const realName = node.id.name;
  const name = path.scope.generateUid(realName);
  const namespaceTopLevel = node.body.body;
  for (let i = 0; i < namespaceTopLevel.length; i++) {
    const subNode = namespaceTopLevel[i];

    // The first switch is mainly to detect name usage. Only export
    // declarations require further transformation.
    switch (subNode.type) {
      case "TSModuleDeclaration": {
        const transformed = handleNested(path, t, subNode);
        const moduleName = subNode.id.name;
        if (names[moduleName]) {
          namespaceTopLevel[i] = transformed;
        } else {
          names[moduleName] = true;
          namespaceTopLevel.splice(
            i++,
            1,
            getDeclaration(t, moduleName),
            transformed,
          );
        }
        continue;
      }
      case "TSEnumDeclaration":
      case "FunctionDeclaration":
      case "ClassDeclaration":
        names[subNode.id.name] = true;
        continue;
      case "VariableDeclaration":
        for (const variable of subNode.declarations) {
          names[variable.id.name] = true;
        }
        continue;
      default:
        // Neither named declaration nor export, continue to next item.
        continue;
      case "ExportNamedDeclaration":
      // Export declarations get parsed using the next switch.
    }

    // Transform the export declarations that occur inside of a namespace.
    switch (subNode.declaration.type) {
      case "TSEnumDeclaration":
      case "FunctionDeclaration":
      case "ClassDeclaration": {
        const itemName = subNode.declaration.id.name;
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
          variable.init = t.assignmentExpression(
            "=",
            getMemberExpression(t, name, variable.id.name),
            variable.init,
          );
        }
        namespaceTopLevel[i] = subNode.declaration;
        break;
      case "TSModuleDeclaration": {
        const transformed = handleNested(path, t, subNode.declaration, name);
        const moduleName = subNode.declaration.id.name;
        if (names[moduleName]) {
          namespaceTopLevel[i] = transformed;
        } else {
          names[moduleName] = true;
          namespaceTopLevel.splice(
            i++,
            1,
            getDeclaration(t, moduleName),
            transformed,
          );
        }
      }
    }
  }

  // {}
  let fallthroughValue = t.objectExpression([]);

  if (parentExportName) {
    // _A.B = {}
    const exportAssignment = t.assignmentExpression(
      "=",
      getMemberExpression(t, parentExportName, realName),
      fallthroughValue,
    );
    // _A.B || (_A.B = {})
    fallthroughValue = t.logicalExpression(
      "||",
      getMemberExpression(t, parentExportName, realName),
      exportAssignment,
    );
  }

  // B = ...
  const assignment = t.assignmentExpression(
    "=",
    t.identifier(realName),
    fallthroughValue,
  );
  // B || (B = ...)
  const parameter = t.logicalExpression(
    "||",
    t.identifier(realName),
    assignment,
  );

  return t.expressionStatement(
    t.callExpression(
      t.functionExpression(
        null,
        [t.identifier(name)],
        t.blockStatement(namespaceTopLevel),
      ),
      [parameter],
    ),
  );
}

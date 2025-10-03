const vscode = require('vscode');

function activate(context) {
    vscode.languages.setLanguageConfiguration('fubelt', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    });

    const config = vscode.workspace.getConfiguration();

    const emmetConfig = config.get('emmet.includeLanguages') || {};
    if (!emmetConfig['fubelt']) {
        config.update('emmet.includeLanguages', {
            ...emmetConfig,
            'fubelt': 'javascriptreact'
        }, vscode.ConfigurationTarget.Global);
    }

    const hoverProvider = vscode.languages.registerHoverProvider('fubelt', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);

            if (word === 'defMeta') {
                return new vscode.Hover('Define metadata for a Fubelt page component');
            }

            return null;
        }
    });

    const completionProvider = vscode.languages.registerCompletionItemProvider('fubelt', {
        provideCompletionItems(document, position, token, context) {
            const completions = [];

            const defMetaCompletion = new vscode.CompletionItem('defMeta', vscode.CompletionItemKind.Function);
            defMetaCompletion.insertText = new vscode.SnippetString('defMeta({\n\tname: "${1:name}",\n\tdocument: {\n\t\ttitle: "${2:title}",\n\t\tdescription: "${3:description}",\n\t\tkeywords: "${4:keywords}"\n\t},\n\tpermissions: {\n\t\tintent: "${5:intent}",\n\t\tlevel: ${6:0}\n\t}\n})');
            defMetaCompletion.documentation = new vscode.MarkdownString('Define metadata for a Fubelt page');
            completions.push(defMetaCompletion);

            const scriptCompletion = new vscode.CompletionItem('script', vscode.CompletionItemKind.Snippet);
            scriptCompletion.insertText = new vscode.SnippetString('<script>\n\t$0\n</script>');
            scriptCompletion.documentation = new vscode.MarkdownString('Add a script block');
            completions.push(scriptCompletion);

            return completions;
        }
    }, '.');

    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('fubelt', {
        provideDocumentFormattingEdits(document) {
            const edits = [];
            const text = document.getText();
            const formatted = formatFubeltDocument(text);

            if (formatted !== text) {
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                edits.push(vscode.TextEdit.replace(fullRange, formatted));
            }

            return edits;
        }
    });

    const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider('fubelt', {
        provideDocumentRangeFormattingEdits(document, range) {
            const edits = [];
            const text = document.getText(range);
            const formatted = formatFubeltDocument(text);

            if (formatted !== text) {
                edits.push(vscode.TextEdit.replace(range, formatted));
            }

            return edits;
        }
    });

    const onTypeFormattingProvider = vscode.languages.registerOnTypeFormattingEditProvider(
        'fubelt',
        {
            provideOnTypeFormattingEdits(document, position, ch) {
                const edits = [];
                const line = document.lineAt(position.line);
                const lineText = line.text;

                if (ch === '>') {
                    const match = lineText.match(/<([a-zA-Z][\w-]*)[^>]*>$/);
                    if (match && !lineText.includes('</')) {
                        const tagName = match[1];
                        const isSelfClosing = lineText.trim().endsWith('/>');

                        if (!isSelfClosing) {
                            const nextLine = position.line + 1;
                            const indent = line.firstNonWhitespaceCharacterIndex;
                            const indentStr = ' '.repeat(indent);

                            const closingTagExists = document.getText().indexOf(`</${tagName}>`, document.offsetAt(position)) !== -1;

                            if (!closingTagExists && nextLine < document.lineCount) {
                                const nextLineText = document.lineAt(nextLine).text;
                                if (nextLineText.trim() === '') {
                                    edits.push(vscode.TextEdit.insert(
                                        new vscode.Position(nextLine, 0),
                                        `${indentStr}</${tagName}>`
                                    ));
                                }
                            }
                        }
                    }
                }

                if (ch === '/') {
                    const beforeSlash = lineText.substring(0, position.character - 1);
                    if (beforeSlash.trim().endsWith('<')) {
                        const openTags = findOpenTags(document, position);
                        if (openTags.length > 0) {
                            const lastOpenTag = openTags[openTags.length - 1];
                            const replacement = `/${lastOpenTag}>`;
                            edits.push(vscode.TextEdit.insert(position, replacement.substring(1)));
                        }
                    }
                }

                return edits;
            }
        },
        '>', '/', '\n'
    );

    context.subscriptions.push(hoverProvider, completionProvider, formattingProvider, rangeFormattingProvider, onTypeFormattingProvider);
}

function formatFubeltDocument(text) {
    let indentLevel = 0;
    const indentChar = '\t';
    const lines = text.split('\n');
    const formattedLines = [];

    let inScriptBlock = false;
    let inStyleBlock = false;
    let scriptStartIndent = 0;
    let styleStartIndent = 0;
    let scriptLines = [];
    let styleLines = [];
    let inJSXContext = false;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed.length === 0) {
            if (inScriptBlock) {
                scriptLines.push('');
            } else if (inStyleBlock) {
                styleLines.push('');
            } else {
                formattedLines.push('');
            }
            continue;
        }

        if (trimmed === '<script>') {
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
            scriptStartIndent = indentLevel;
            indentLevel++;
            inScriptBlock = true;
            scriptLines = [];
            continue;
        }

        if (trimmed === '</script>') {
            const formattedScript = formatJavaScript(scriptLines.join('\n'), scriptStartIndent + 1);
            formattedLines.push(...formattedScript.split('\n').filter(line => line || formattedScript.includes('\n\n')));

            indentLevel = scriptStartIndent;
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
            inScriptBlock = false;
            scriptLines = [];
            continue;
        }

        if (trimmed === '<style>') {
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
            styleStartIndent = indentLevel;
            indentLevel++;
            inStyleBlock = true;
            styleLines = [];
            continue;
        }

        if (trimmed === '</style>') {
            const formattedStyle = formatCSS(styleLines.join('\n'), styleStartIndent + 1);
            formattedLines.push(...formattedStyle.split('\n').filter(line => line || formattedStyle.includes('\n\n')));

            indentLevel = styleStartIndent;
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
            inStyleBlock = false;
            styleLines = [];
            continue;
        }

        if (inScriptBlock) {
            scriptLines.push(trimmed);
            continue;
        }

        if (inStyleBlock) {
            styleLines.push(trimmed);
            continue;
        }

        const isJSXLine = trimmed.startsWith('<') && !trimmed.startsWith('<script>') && !trimmed.startsWith('<style>');
        const isJSXClose = trimmed.startsWith('</') && !trimmed.startsWith('</script>') && !trimmed.startsWith('</style>');

        const isJavaScriptLine = /^(import |export |const |let |var |function |class |return\s*\(|}\s*\)|[a-zA-Z_$][\w$]*\s*[=({]|\}\s*;)/.test(trimmed);

        if (isJSXLine || isJSXClose) {
            inJSXContext = true;
        }

        if (isJavaScriptLine && !inJSXContext) {
            if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);

            const openCount = (trimmed.match(/[{[(]/g) || []).length;
            const closeCount = (trimmed.match(/[}\])]/g) || []).length;
            let netChange = openCount - closeCount;

            if (trimmed.match(/\w+\s*\(\s*\{$/)) {
                netChange = 1;
            }

            if (trimmed.endsWith('},') || trimmed.endsWith('],') || trimmed.endsWith('),')) {
                netChange = 0;
            }

            indentLevel += netChange;
            indentLevel = Math.max(0, indentLevel);
        }
        else if (trimmed.match(/<[^/>][^>]*>.*<\/[^>]+>/) && !trimmed.startsWith('</')) {
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
        }
        else if (isJSXClose) {
            indentLevel = Math.max(0, indentLevel - 1);
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
        }
        else if (trimmed.endsWith('/>')) {
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
        }
        else if (isJSXLine && trimmed.endsWith('>') && !trimmed.startsWith('</')) {
            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);
            indentLevel++;
        }
        else {
            if (trimmed.startsWith('}') || trimmed.startsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            formattedLines.push(indentChar.repeat(indentLevel) + trimmed);

            if (trimmed.endsWith('(') || (trimmed.endsWith('{') && !trimmed.includes('}'))) {
                indentLevel++;
            }
        }
    }

    return formattedLines.join('\n');
}

function formatJavaScript(code, baseIndent = 0) {
    const indentChar = '\t';
    const lines = code.split('\n');
    const formatted = [];
    let indentLevel = 0;

    for (let line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            formatted.push('');
            continue;
        }

        if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        formatted.push(indentChar.repeat(baseIndent + indentLevel) + trimmed);

        const openCount = (trimmed.match(/[{[(]/g) || []).length;
        const closeCount = (trimmed.match(/[}\])]/g) || []).length;
        let netChange = openCount - closeCount;

        if (trimmed.match(/\w+\s*\(\s*\{$/)) {
        }

        if (trimmed.endsWith('},') || trimmed.endsWith('],') || trimmed.endsWith('),')) {
            netChange = 0;
        }

        indentLevel += netChange;
        indentLevel = Math.max(0, indentLevel);
    }

    return formatted.join('\n');
}

function formatCSS(code, baseIndent = 0) {
    const indentChar = '\t';
    const lines = code.split('\n');
    const formatted = [];
    let indentLevel = 0;

    for (let line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            formatted.push('');
            continue;
        }

        if (trimmed.startsWith('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        formatted.push(indentChar.repeat(baseIndent + indentLevel) + trimmed);

        if (trimmed.includes('{') && !trimmed.includes('}')) {
            indentLevel++;
        }
    }

    return formatted.join('\n');
}

function findOpenTags(document, position) {
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const openTags = [];
    const tagRegex = /<(\/?)([\w-]+)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        const isClosing = match[1] === '/';
        const tagName = match[2];

        if (isClosing) {
            for (let i = openTags.length - 1; i >= 0; i--) {
                if (openTags[i] === tagName) {
                    openTags.splice(i, 1);
                    break;
                }
            }
        } else {
            if (!match[0].endsWith('/>')) {
                openTags.push(tagName);
            }
        }
    }

    return openTags;
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
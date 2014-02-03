define(function (require, exports, module) {
	'use strict';

	var CommandManager = brackets.getModule("command/CommandManager"),
		Commands = brackets.getModule('command/Commands'),
		DocumentManager = brackets.getModule("document/DocumentManager"),
		PanelManager = brackets.getModule("view/PanelManager"),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		NodeConnection = brackets.getModule("utils/NodeConnection"),
		Menus = brackets.getModule("command/Menus"),
		node = new NodeConnection(),
		domainPath = ExtensionUtils.getModulePath(module) + "domain",
		tidyPath = ExtensionUtils.getModulePath(module) + "python-tidy.py";

	var panel,
		panelHTML = require('text!pythontidy-panel.html'),
		autosave = (localStorage["pythontidy.autosave"] === "true");

	var COMMAND_ID = "com.josecols.PythonTidy",
		COMMAND_NAME = "Python Tidy";

	function _processStdout(formattedText, document) {
		formattedText = JSON.parse(JSON.stringify(formattedText).replace(/\\r/g, ''));

		if (document.getText() != formattedText) {
			document.setText(formattedText);
			CommandManager.execute(Commands.FILE_SAVE, {
				doc: document
			});
		}
	}

	function _processStderror(error) {
		error = JSON.stringify(error);
		error = error.replace(/\\n/g, '<br>').replace(/\"/g, '').replace(/\\t/g, '').replace(/\\r/g, '');

		return panelHTML.replace("{{content}}", error);
	}


	function _processPanel(panel) {
		panel.show();

		$('.pythontidy-panel .close').on('click', function () {
			panel.hide();
		});
	}

	function tidy() {
		var document = DocumentManager.getCurrentDocument(),
			directory = document.file._parentPath,
			file = document.file._path,
			language = document.language._name,
			cmd = '';

		if ('python' === language.toLowerCase()) {
			node.connect(true).fail(function (error) {
				console.error("Python Tidy cannot connect to node: ", error);
			}).then(function () {
				return node.loadDomains([domainPath], true).fail(function (error) {
					console.error("Python Tidy cannot register domain: ", error);
				});
			}).then(function () {
				cmd = 'python "' + tidyPath + '" "' + file + '"';
			}).then(function () {
				node.domains["python-tidy.execute"].exec(directory, cmd)
					.fail(function (error) {
						panel = PanelManager.createBottomPanel("pythontidy-panel", $(_processStderror(error)));
						_processPanel(panel);
					})
					.then(function (formattedText) {
						_processStdout(formattedText, document);
					});
			}).done();
		}
	}

	$(DocumentManager).on("documentSaved", function (event, document) {
		if (autosave) {
			var fileExtension = document.file.name.split(".").pop().toLowerCase();

			if (fileExtension === "py" || fileExtension === "python") {
				tidy();
			}
		}
	});

	CommandManager.register(COMMAND_NAME, COMMAND_ID, tidy);

	CommandManager.register(COMMAND_NAME + " on Save", COMMAND_ID + ".autosave", function () {
		this.setChecked(!this.getChecked());
	});

	var autosaveItem = CommandManager.get(COMMAND_ID + ".autosave");
	autosaveItem.setChecked(autosave);

	$(autosaveItem).on('checkedStateChange', function () {
		autosave = autosaveItem.getChecked();
		localStorage["pythontidy.autosave"] = autosave;
	});

	var windowsCommand = {
		key: "Ctrl-P",
		platform: "win"
	};
	var macCommand = {
		key: "Cmd-P",
		platform: "mac"
	};

	var command = [windowsCommand, macCommand],
		menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);

	menu.addMenuDivider();
	menu.addMenuItem(COMMAND_ID, command);
	menu.addMenuItem(autosaveItem);

	ExtensionUtils.loadStyleSheet(module, "python-tidy.css");
});
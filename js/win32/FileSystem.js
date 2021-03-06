
//
// FileSystem.js
// Extension for FileSystemObject
//
// Copyright (c) 2009 by Ildar Shaimordanov
//

if ( 'undefined' == typeof FileSystem ) {

function FileSystem()
{
};

}

FileSystem.fileName = WScript.ScriptName;

FileSystem.fullName = WScript.ScriptFullName;

FileSystem.dirName = FileSystem.fullName.replace(/\\[^\\]+$/, '');

/**
 * The fastest looking for files/folders specified by options.
 * The options are:
 * -- path - string/array of strings defines folders where a search should be performed
 * -- pattern - string/array of strings defines wildcards to be searched
 * -- included - string/array of strings defines wildcards for files that should be leaved in the resulting list
 * -- excluded - string/array of strings defines wildcards for files that should be excluded from the resulting list
 * -- filter - function is used for aditional filtration of the resulting list, accepts full pathname
 * -- each - fuunction is used to perform some action over each file/folder
 * -- folders - boolean indicates for searching of folders instead files
 * -- recursive -- boolean indicates that searching should be performed for all subfolders recursively
 * -- codepage - string indicates a codepage for the DOS command "CHCP", is used if it differs of a script's codepage
 * 
 * Returns an array containing the matched files/folders or the number of processed files/folders 
 * when the 'each' function is defined. 
 *
 * Here are additional results for debugging reasons:
 * FileSystem.find.cmd - a list of commands
 * FileSystem.find.error - a list of error messages
 * FileSystem.find.exitCode - a list of exit codes
 *
 * @code
 * <code>
 * // Example 1
 * // Get all files from the current directory
 * var filelist = FileSystem.find();
 * </code>
 * 
 * <code>
 * // Example 2
 * // Get all files with names x* and z*, excluding *.dll from the specified folder
 * var options = {
 * 	path: 'C:\\Windows\\System32', 
 * 
 * 	pattern: '*', 
 * 	included: ['x*', 'z*'], 
 * 	excluded: '*.dll'
 * };
 *
 * var filelist = FileSystem.find(options);
 * </code>
 * 
 * <code>
 * // Example 3
 * // Find all files corresponding the pattern z* and print a message that a file is found
 * // Finally print the number of found files
 * var options = {
 * 	// search within
 * 	path: 'C:\\Windows\\System32', 
 * 
 * 	// search in all subfolders
 * 	recursive: true, 
 * 
 * 	// search files only corresponding the pattern z*
 * 	filter: function(filename) { return filename.match(/\\z[^\\]*$/i); }, 
 * 
 * 	// for each file output a message
 * 	each: function(filename) { WScript.Echo(filename + ' is found'); }
 * };
 * 
 * var f = FileSystem.find(options);
 * 
 * // print the number of found files
 * WScript.Echo(f + ' files was found');
 * </code>
 *
 * @param	object	Options, modifying the resulting list
 * @return	Array|Number
 * @access	static
 */
(function()
{
	var each;
	var filter;

	var result;

	var path;
	var pp;

	var cmd;
	var error;
	var exitCode;

	var delay = 0;

	// Preparation procedure
	var _prepFind = function(options)
	{
		options = options || {};

		// Delay in milliseconds when collecting data from commands
		if ( options.delay > 0 ) {
			delay = options.delay;
		}

		// Prepare the storage of commands, errors and exit codes for debugging reasons
		cmd = [];
		error = [];
		exitCode = [];

		var f;
		if ( options.folders ) {
			f = ' /ad ';
		} else {
			f = ' /a-d ';
		}

		var p;
		var s;
		var b;
		if ( options.recursive ) {
			p = function(path)
			{
				return '';
			};
			s = ' /s ';
			b = ' \\\\';
		} else {
			p = function(path)
			{
				return path;
			};
			s = '';
			b = ' ^';
		}

		// Create common parts of a command
		var cmd1 = '';
		if ( options.codepage ) {
			cmd1 += '%COMSPEC% /c chcp ' + options.codepage + '>nul && ';
		}
		cmd1 += '%COMSPEC% /c dir /b ' + f + s;

		var cmd3 = '';
		if ( options.included ) {
			cmd3 += ' | findstr /i /e "' + b + FileSystem.wildcard2regex(options.included, true, true).join(b) + '"';
		}
		if ( options.excluded ) {
			cmd3 += ' | findstr /v /i /e "' + b + FileSystem.wildcard2regex(options.excluded, true, true).join(b) + '"';
		}

		// Prepare paths and prefixes
		path = [].concat(options.path);
		pp = [];

		// Populate a pattern by the default value
		var pattern = [].concat(options.pattern || '*');

		// Normalize paths, prefixes and finish creation of commands
		var fso = new ActiveXObject('Scripting.FileSystemObject');
		for (var i = 0; i < path.length; i++) {
			path[i] = fso.GetAbsolutePathName(path[i]);
			var cmd2;
			if ( fso.FileExists(path[i]) || path[i].match(/[\?\*]/) ) {
				// Path is the full name of an existing file or contains wildcards
				cmd2 = path[i];
				pp[i] = p(path[i].replace(/[^\\]+$/, ''));
			} else {
				if ( path[i].slice(-2) != ':\\' ) {
					path[i] += '\\';
				}
				cmd2 = path[i] + pattern.join('" "' + path[i]);
				pp[i] = p(path[i]);
			}
			var cmdLine = [cmd1, '"', cmd2, '"', cmd3].join('');
			cmd.push(cmdLine);
		}

		// Initialize the result variable and an iterator per each resulting string
		if ( typeof options.each == 'function' ) {
			result = 0;
			each = function(v)
			{
				result++;
				options.each(v);
			};
		} else {
			result = [];
			each = function(v)
			{
				result.push(v);
			};
		}

		// Initialize a filter function
		if ( typeof options.filter == 'function' ) {
			filter = function(v)
			{
				if ( options.filter(v, options) ) {
					each(v);
				}
			};
		} else {
			filter = each;
		}
	};

	// Searching procedure
	var _makeFind = function()
	{
		// Perform the shell command ...
		var sh = new ActiveXObject('WScript.Shell');

		for (var i = 0; i < path.length; i++) {
			var ex = sh.Exec(cmd[i]);

			// ... and collect each string from the STDOUT and STDERR outputs
			var err = '';
			while ( 1 ) {
				if ( ! ex.StdOut.AtEndOfStream ) {
					filter(pp[i] + ex.StdOut.ReadLine());
					continue;
				}
				if ( ! ex.StdErr.AtEndOfStream ) {
					err += ex.StdErr.ReadLine();
					continue;
				}
				if ( ex.Status == 1 ) {
					break;
				}
				WScript.Sleep(delay);
			}

			// Store error messages and exit codes for debugging reasons
			error.push(err);
			exitCode.push(ex.ExitCode);
		}
	};

	FileSystem.find = function(options)
	{
		var start = (new Date()).getTime();

		// Prepare iterim variables
		_prepFind(options);

		// Perform searching
		_makeFind();

		// Store commands, errors, exit codes and duration for debugging reason
		arguments.callee.debug = {
			cmd: cmd, 
			error: error, 
			exitCode: exitCode, 
			duration: (new Date()).getTime() - start
		};

		return result;
	};

})();

/**
 * Transforms standard DOS-wildcards to a native Javascript regular expression
 *
 * @example
 * var w = ['*.js', '*.vbs'];
 * var r = FileSystem.wildcard2regex(wc); // is regexp: /^(.*?\.js|.*?\.vbs)$/i
 *
 * @param	string|array	a wildcard or a list of wildcards
 * @param	boolean	if is TRUE, then returns an array of patterns, no regexp
 * @param	boolean	if is TRUE, then makes strict pattern (any character excepting the backslash "\\")
 * @return	regexp|array
 * @access	static
 */
FileSystem.wildcard2regex = function(wildcard, skipRegexp, strictly)
{
	var convert = arguments.callee[strictly ? 'strictly' : 'std'];

	var result = [];
	if ( Object.prototype.toString.call(wildcard) == '[object String]' ) {
		result.push(convert(wildcard));
	} else {
		for (var i = 0; i < wildcard.length; i++) {
			result.push(convert(wildcard[i]));
		}
	}

	return skipRegexp 
		? result 
		: new RegExp('^(' + result.join('|') + ')$', 'i');
};

FileSystem.wildcard2regex.strictly = function(wildcard)
{
	var result = wildcard
		.replace(/([\^\$\\\/\|\.\+\!\[\]\(\)\{\}])/g, '\\$1')
		.replace(/\?/g, '[^\\\\]?')
		.replace(/\*/g, '[^\\\\]*')
		;
	return result;
};

FileSystem.wildcard2regex.std = function(wildcard)
{
	var result = wildcard
		.replace(/([\^\$\\\/\|\.\+\!\[\]\(\)\{\}])/g, '\\$1')
		.replace(/\?/g, '.?')
		.replace(/\*/g, '.*?')
		;
	return result;
};

(function()
{

/**
 * Opens input stream or filename and reads it.
 * If input is file it will be closed.
 *
 * @param	mixed	Input stream
 * @return	String
 * @access	static
 */
FileSystem.readFile = function(input, format)
{
	var h, wasFilename;

	if ( input && 'object' == typeof input ) {
		h = input;
	} else {
		wasFilename = true;
		var fso = new ActiveXObject('Scripting.FileSystemObject');
		var f = fso.GetFile(input);
		h = f.OpenAsTextStream(1, Number(format) || 0);
	}

	var result = h.ReadAll();

	if ( wasFilename ) {
		h.Close();
	}

	return result;
};

var writer = function(output, text, iomode, create, format)
{
	var h, wasFilename;

	if ( output && 'object' == typeof output ) {
		h = output;
	} else {
		wasFilename = true;
		var fso = new ActiveXObject('Scripting.FileSystemObject');
		h = fso.OpenTextFile(output, iomode, create, format || 0);
	}

	h.Write(text);

	if ( wasFilename ) {
		h.Close();
	}
};

/**
 * Opens output stream or filename and writes into it.
 * If output is file it will be closed.
 *
 * @param	mixed	Output stream.
 * @param	String	Output buffer
 * @param	Boolean	Boolean value that indicates whether a new file can be created if the specified filename doesn't exist.
 * @param	Integer	The format of the opened file. If omitted, the file is opened as ASCII.
 * @return	void
 * @access	static
 *
 * @require	fso FileSystemObject created
 */
FileSystem.writeFile = function(output, text, create, format)
{
	writer(output, text, 2, create, format);
};

/**
 * Opens output stream or filename and writes to the end of file.
 * If output is file it will be closed.
 *
 * @param	mixed	Output stream.
 * @param	String	Output buffer
 * @param	Boolean	Boolean value that indicates whether a new file can be created if the specified filename doesn't exist.
 * @param	Integer	The format of the opened file. If omitted, the file is opened as ASCII.
 * @return	void
 * @access	static
 *
 * @require	fso FileSystemObject created
 */
FileSystem.appendFile = function(output, text, create, format)
{
	writer(output, text, 8, create, format);
};

})();

(function()
{

/**
 * Transforms standard DOS-wildcards to native Javascript regular expressions
 *
 * @example
 * var w = '*.js';
 * var r = wildcard(wc, 0); // is string: '.*?\.js'
 * var q = wildcard(wc, 1); // is regexp: /.*?\.js/
 *
 * @param	string|array	wildcard
 * @param	boolean	if is TRUE, then return a regular expression
 * @return	string|regep
 * @access	static
 */
var _wildcard2regexp = function(wildcard, returnRegex)
{
	var pattern = wildcard
		.replace(/([\^\$\\\/\|\.\+\!\[\]\(\)\{\}])/g, '\\$1')
		.replace(/\?/g, '.?')
		.replace(/\*/g, '.*?')
		;
	return returnRegex 
		? new RegExp(pattern) 
		: pattern;
};

FileSystem.wildcard2regexp = function(wildcard, returnRegexp)
{
	if ( Object.prototype.toString.call(wildcard) == '[object String]' ) {
		return _wildcard2regexp.apply(null, arguments);
	}

	var result = [];
	for (var i = 0; i < wildcard.length; i++) {
		if ( i in wildcard ) {
			result.push(_wildcard2regexp(wildcard[i]));
		}
	}
	return new RegExp(result.join('|'));
};

})();

/**
 * Finds pathnames matching a pattern. 
 * Returns an array containing the matched files/folders.
 *
 * @code
 * <code>
 * var filespec = 'C:\\WINDOWS\\*';
 *
 * // Get the file list
 * var filelist = FileSystem.glob(filespec);
 *
 * //Get the folder list
 * var foldlist = FileSystem.glob(filespec, true);
 * </code>
 *
 * @param	String	pattern		The pattern which is looking for
 * @param	Boolean	foldersOnly	Return only folder entries which match the pattern instead of files
 * @return	Array
 * @access	public
 */
FileSystem.glob = function(pattern, foldersOnly)
{
	var fso = new ActiveXObject('Scripting.FileSystemObject');

	// Validate the single file/folder
	var matches = pattern.match(/((?:[a-zA-Z]\:)?.*?\\?)([^\\]*?[\*\?][^\\]*?$)/);
	if ( ! matches ) {
//		// this commened stupid code is kept for history
//		if ( 
//		( foldersOnly && fso.FolderExists(pattern) ) 
//		|| 
//		( ! foldersOnly && fso.FileExists(pattern) ) ) {
		if ( fso.FileExists(pattern) ) {
			return [fso.GetAbsolutePathName(pattern)];
		}
		throw new Error(pattern + ': File not found');
	}

	var regexp = new RegExp();
	var regsrc = matches[2]
		.replace(/\\/g, '\\\\')
		.replace(/([\^\$\+\.\[\]\(\)\|])/g, '\\$1')
		.replace(/\?/g, '.')
		.replace(/\*/g, '.*?');

	regexp.compile('\\\\' + regsrc + '$', 'i');

	var folderspec = matches[1];
	var collection = foldersOnly ? 'SubFolders' : 'Files';

	var f = fso.GetFolder(fso.GetAbsolutePathName(folderspec));
	var fc = new Enumerator(f[collection]);

	var result = [];
	for ( ; !fc.atEnd(); fc.moveNext()) {
		var i = fc.item();
		if ( ! regexp.test(i) ) {
			continue;
		}
		result.push(i);
	}
	return result;
};

/**
 * Calculates and returns a complete and unambiguous path from a provided path specification. 
 * Resolves relative paths and short names. 
 *
 * @example
 * var s = 'C:\\Windows\\..\\Program Files';
 * 
 * // C:\Program Files
 * var t = FileSystem.GetAbsolutePathName(s);
 *
 * @param	String
 * @return	String
 */
FileSystem.GetAbsolutePathName = function(filespec, fso)
{
	fso = fso || new ActiveXObject("Scripting.FileSystemObject");
	return fso.GetAbsolutePathName(filespec);
};

/**
 * Calculates the long filename to the provided filespec. 
 * Resolves relative paths and short names. 
 *
 * @example
 * var s = 'C:\\PROGRA~1';
 * 
 * // C:\Program Files
 * var t = FileSystem.GetLongPathName(s);
 *
 * @param	String
 * @return	String
 */
FileSystem.GetLongPathName = function(filespec, fso)
{
	fso = fso || new ActiveXObject('Scripting.FileSystemObject');

	var filename = fso.GetAbsolutePathName(filespec);

	// Skip a parsing of the root folder
	if ( filename.slice(-2) == ':\\' ) {
		return filename;
	}

	// Split to a path and trailing name
	var path = fso.GetParentFolderName(filename);
	var name = fso.GetFileName(filename);

	var ns = (new ActiveXObject('Shell.Application')).Namespace(path);
	if ( ! ns ) {
		return null;
	}

	return ns.ParseName(name).Path;
};

/**
 * Calculates the short filename to the provided filespec. 
 * Resolves relative paths and short names. 
 *
 * @example
 * var s = 'C:\\Program Files';
 * 
 * // C:\PROGRA~1
 * var t = FileSystem.GetShortPathName(s);
 *
 * @param	String
 * @return	String
 */
FileSystem.GetShortPathName = function(filespec, fso)
{
	fso = fso || new ActiveXObject('Scripting.FileSystemObject');

	var filename = fso.GetAbsolutePathName(filespec);

	var getter;
	if ( fso.FileExists(filename) ) {
		getter = 'GetFile';
	} else if ( fso.FolderExists(filename) ) {
		getter = 'GetFolder';
	} else {
		return null;
	}

	return fso[getter](filename).ShortPath;
};

/**
 * Creates a dialog box that enables the user to select a folder and then returns the selected folder's path.
 *
 * @param	Integer	Hwnd		The handle to the parent window of the dialog box. This value can be zero. 
 * @param	String	sTitle		A String value that represents the title displayed inside the Browse dialog box.
 * @param	Integer	iOptions	An Integer value that contains the options for the method. This can be zero or a combination of the BIF_xxx values.
 * @param	Mixed	vRootFolder	The root folder to use in the dialog box. The user cannot browse higher in the tree than this folder. If this value is not specified, the root folder used in the dialog box is the desktop. This value can be a string that specifies the path of the folder or one of the BSF_XXX values. 
 * @return	String	Fully qualified path to folder
 *
 * @see		http://msdn.microsoft.com/en-us/library/bb774065(VS.85).aspx
 * @see		http://msdn.microsoft.com/en-us/library/bb773205(VS.85).aspx
 * @see		http://msdn.microsoft.com/en-us/library/bb774096(VS.85).aspx
 * @see		http://blogs.msdn.com/gstemp/archive/2004/02/17/74868.aspx#ctl00___ctl00___ctl00_ctl00_bcr_ctl00___Comments___Comments_ctl07_NameLink
 */
FileSystem.BrowseForFolder = function(Hwnd, sTitle, iOptions, vRootFolder)
{
	var shell = new ActiveXObject("Shell.Application");
	var folder = shell.BrowseForFolder(Hwnd, sTitle, iOptions, vRootFolder);

	// Dialog has been closed (by the Close command or the Cancel button)
	if ( folder == null ) {
		return null;
	}

	var e;
	var path = null;

	try {
		path = folder.ParentFolder.ParseName(folder.Title).Path;
	} catch (e) {
		var colon = folder.Title.lastIndexOf(":");
		if ( colon == -1 ) {
			return null;
		}

		path = folder.Title.slice(colon - 1, colon + 1) + "\\";
	}

	return path;
};

/**
 * Parameters for the SHBrowseForFolder function and receives information about the folder selected by the user.
 *
 * @see		http://msdn.microsoft.com/en-us/library/bb773205(VS.85).aspx
 */
FileSystem.BrowseForFolder.BIF_RETURNONLYFSDIRS	= 0x0001; // Only return file system directories. If the user selects folders that are not part of the file system, the OK button is grayed. Note  The OK button remains enabled for "\\server" items, as well as "\\server\share" and directory items. However, if the user selects a "\\server" item, passing the PIDL returned by SHBrowseForFolder to SHGetPathFromIDList fails.
FileSystem.BrowseForFolder.BIF_DONTGOBELOWDOMAIN	= 0x0002; // Do not include network folders below the domain level in the dialog box's tree view control.
FileSystem.BrowseForFolder.BIF_STATUSTEXT		= 0x0004; // Include a status area in the dialog box. The callback function can set the status text by sending messages to the dialog box. This flag is not supported when BIF_NEWDIALOGSTYLE is specified.
FileSystem.BrowseForFolder.BIF_RETURNFSANCESTORS	= 0x0008; // Only return file system ancestors. An ancestor is a subfolder that is beneath the root folder in the namespace hierarchy. If the user selects an ancestor of the root folder that is not part of the file system, the OK button is grayed.
FileSystem.BrowseForFolder.BIF_EDITBOX		= 0x0010; // Version 4.71. Include an edit control in the browse dialog box that allows the user to type the name of an item.
FileSystem.BrowseForFolder.BIF_VALIDATE		= 0x0020; // Version 4.71. If the user types an invalid name into the edit box, the browse dialog box calls the application's BrowseCallbackProc with the BFFM_VALIDATEFAILED message. This flag is ignored if BIF_EDITBOX is not specified.
FileSystem.BrowseForFolder.BIF_NEWDIALOGSTYLE	= 0x0040; // Version 5.0. Use the new user interface. Setting this flag provides the user with a larger dialog box that can be resized. The dialog box has several new capabilities, including: drag-and-drop capability within the dialog box, reordering, shortcut menus, new folders, delete, and other shortcut menu commands. Note  If Component Object Model (COM) is initialized through CoInitializeEx with the COINIT_MULTITHREADED flag set, SHBrowseForFolder fails if BIF_NEWDIALOGSTYLE is passed.
FileSystem.BrowseForFolder.BIF_BROWSEINCLUDEURLS	= 0x0080; // Version 5.0. The browse dialog box can display URLs. The BIF_USENEWUI and BIF_BROWSEINCLUDEFILES flags must also be set. If any of these three flags are not set, the browser dialog box rejects URLs. Even when these flags are set, the browse dialog box displays URLs only if the folder that contains the selected item supports URLs. When the folder's IShellFolder::GetAttributesOf method is called to request the selected item's attributes, the folder must set the SFGAO_FOLDER attribute flag. Otherwise, the browse dialog box will not display the URL.
FileSystem.BrowseForFolder.BIF_USENEWUI		= FileSystem.BrowseForFolder.BIF_EDITBOX | FileSystem.BrowseForFolder.BIF_NEWDIALOGSTYLE; // Version 5.0. Use the new user interface, including an edit box. This flag is equivalent to BIF_EDITBOX | BIF_NEWDIALOGSTYLE. Note  If COM is initialized through CoInitializeEx with the COINIT_MULTITHREADED flag set, SHBrowseForFolder fails if BIF_USENEWUI is passed.
FileSystem.BrowseForFolder.BIF_UAHINT		= 0x0100; // Version 6.0. When combined with BIF_NEWDIALOGSTYLE, adds a usage hint to the dialog box, in place of the edit box. BIF_EDITBOX overrides this flag.
FileSystem.BrowseForFolder.BIF_NONEWFOLDERBUTTON	= 0x0200; // Version 6.0. Do not include the New Folder button in the browse dialog box.
FileSystem.BrowseForFolder.BIF_NOTRANSLATETARGETS	= 0x0400; // Version 6.0. When the selected item is a shortcut, return the PIDL of the shortcut itself rather than its target.
FileSystem.BrowseForFolder.BIF_BROWSEFORCOMPUTER	= 0x1000; // Only return computers. If the user selects anything other than a computer, the OK button is grayed.
FileSystem.BrowseForFolder.BIF_BROWSEFORPRINTER	= 0x2000; // Only allow the selection of printers. If the user selects anything other than a printer, the OK button is grayed. In Microsoft Windows XP and later systems, the best practice is to use a Windows XP-style dialog, setting the root of the dialog to the Printers and Faxes folder (CSIDL_PRINTERS).
FileSystem.BrowseForFolder.BIF_BROWSEINCLUDEFILES	= 0x4000; // Version 4.71. The browse dialog box displays files as well as folders.
FileSystem.BrowseForFolder.BIF_SHAREABLE		= 0x8000; // Version 5.0. The browse dialog box can display shareable resources on remote systems. This is intended for applications that want to expose remote shares on a local system. The BIF_NEWDIALOGSTYLE flag must also be set.

/**
 * ShellSpecialFolderConstants Enumerated Type
 *
 * @see		http://msdn.microsoft.com/en-us/library/bb774096(VS.85).aspx
 */
FileSystem.BrowseForFolder.BSF_DESKTOP		= 0x00; // (0). Microsoft Windows desktop-the virtual folder that is the root of the namespace.
//FileSystem.BrowseForFolder.BSF_INTERNETEXPLORER	= 0x01; // (1). Internet Explorer is the root.
FileSystem.BrowseForFolder.BSF_PROGRAMS		= 0x02; // (2). File system directory that contains the user's program groups (which are also file system directories). A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\Start Menu\Programs.
FileSystem.BrowseForFolder.BSF_CONTROLS		= 0x03; // (3). Virtual folder that contains icons for the Control Panel applications.
FileSystem.BrowseForFolder.BSF_PRINTERS		= 0x04; // (4). Virtual folder that contains installed printers.
FileSystem.BrowseForFolder.BSF_PERSONAL		= 0x05; // (5). File system directory that serves as a common repository for a user's documents. A typical path is C:\Users\username\Documents.
FileSystem.BrowseForFolder.BSF_FAVORITES		= 0x06; // (6). File system directory that serves as a common repository for the user's favorite URLs. A typical path is C:\Documents and Settings\username\Favorites.
FileSystem.BrowseForFolder.BSF_STARTUP		= 0x07; // (7). File system directory that corresponds to the user's Startup program group. The system starts these programs whenever any user first logs into their profile after a reboot. A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\StartUp.
FileSystem.BrowseForFolder.BSF_RECENT		= 0x08; // (8). File system directory that contains the user's most recently used documents. A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\Recent.
FileSystem.BrowseForFolder.BSF_SENDTO		= 0x09; // (9). File system directory that contains Send To menu items. A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\SendTo.
FileSystem.BrowseForFolder.BSF_BITBUCKET		= 0x0a; // (10). Virtual folder that contains the objects in the user's Recycle Bin.
FileSystem.BrowseForFolder.BSF_STARTMENU		= 0x0b; // (11). File system directory that contains Start menu items. A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\Start Menu.

FileSystem.BrowseForFolder.BSF_DESKTOPDIRECTORY	= 0x10; // (16). File system directory used to physically store the file objects that are displayed on the desktop. It is not to be confused with the desktop folder itself, which is a virtual folder. A typical path is C:\Documents and Settings\username\Desktop.
FileSystem.BrowseForFolder.BSF_DRIVES		= 0x11; // (17). My Computer-the virtual folder that contains everything on the local computer: storage devices, printers, and Control Panel. This folder can also contain mapped network drives.
FileSystem.BrowseForFolder.BSF_NETWORK		= 0x12; // (18). Network Neighborhood-the virtual folder that represents the root of the network namespace hierarchy.
FileSystem.BrowseForFolder.BSF_NETHOOD		= 0x13; // (19). A file system folder that contains any link objects in the My Network Places virtual folder. It is not the same as FileSystem.BrowseForFolder.BSF_NETWORK, which represents the network namespace root. A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\Network Shortcuts.
FileSystem.BrowseForFolder.BSF_FONTS		= 0x14; // (20). Virtual folder that contains installed fonts. A typical path is C:\Windows\Fonts.
FileSystem.BrowseForFolder.BSF_TEMPLATES		= 0x15; // (21). File system directory that serves as a common repository for document templates.
FileSystem.BrowseForFolder.BSF_COMMONSTARTMENU	= 0x16; // (22). File system directory that contains the programs and folders that appear on the Start menu for all users. A typical path is C:\Documents and Settings\All Users\Start Menu. Valid only for Windows NT systems.
FileSystem.BrowseForFolder.BSF_COMMONPROGRAMS	= 0x17; // (23). File system directory that contains the directories for the common program groups that appear on the Start menu for all users. A typical path is C:\Documents and Settings\All Users\Start Menu\Programs. Valid only for Windows NT systems.
FileSystem.BrowseForFolder.BSF_COMMONSTARTUP	= 0x18; // (24). File system directory that contains the programs that appear in the Startup folder for all users. A typical path is C:\Documents and Settings\All Users\Microsoft\Windows\Start Menu\Programs\StartUp. Valid only for Windows NT systems.
FileSystem.BrowseForFolder.BSF_COMMONDESKTOPDIR	= 0x19; // (25). File system directory that contains files and folders that appear on the desktop for all users. A typical path is C:\Documents and Settings\All Users\Desktop. Valid only for Windows NT systems.
FileSystem.BrowseForFolder.BSF_APPDATA		= 0x1a; // (26). Version 4.71. File system directory that serves as a common repository for application-specific data. A typical path is C:\Documents and Settings\username\Application Data.
FileSystem.BrowseForFolder.BSF_PRINTHOOD		= 0x1b; // (27). File system directory that contains any link objects in the Printers virtual folder. A typical path is C:\Users\username\AppData\Roaming\Microsoft\Windows\Printer Shortcuts.
FileSystem.BrowseForFolder.BSF_LOCALAPPDATA	= 0x1c; // (28). Version 5.0. File system directory that serves as a data repository for local (non-roaming) applications. A typical path is C:\Users\username\AppData\Local.
FileSystem.BrowseForFolder.BSF_ALTSTARTUP		= 0x1d; // (29). File system directory that corresponds to the user's non-localized Startup program group.
FileSystem.BrowseForFolder.BSF_COMMONALTSTARTUP	= 0x1e; // (30). File system directory that corresponds to the non-localized Startup program group for all users. Valid only for Microsoft Windows NT systems.
FileSystem.BrowseForFolder.BSF_COMMONFAVORITES	= 0x1f; // (31). File system directory that serves as a common repository for the favorite URLs shared by all users. Valid only for Windows NT systems.
FileSystem.BrowseForFolder.BSF_INTERNETCACHE	= 0x20; // (32). File system directory that serves as a common repository for temporary Internet files. A typical path is C:\Users\username\AppData\Local\Microsoft\Windows\Temporary Internet Files.
FileSystem.BrowseForFolder.BSF_COOKIES		= 0x21; // (33). File system directory that serves as a common repository for Internet cookies. A typical path is C:\Documents and Settings\username\Application Data\Microsoft\Windows\Cookies.
FileSystem.BrowseForFolder.BSF_HISTORY		= 0x22; // (34). File system directory that serves as a common repository for Internet history items.
FileSystem.BrowseForFolder.BSF_COMMONAPPDATA	= 0x23; // (35). Version 5.0. Application data for all users. A typical path is C:\Documents and Settings\All Users\Application Data.
FileSystem.BrowseForFolder.BSF_WINDOWS		= 0x24; // (36). Version 5.0. Windows directory. This corresponds to the %windir% or %SystemRoot% environment variables. A typical path is C:\Windows.
FileSystem.BrowseForFolder.BSF_SYSTEM		= 0x25; // (37). Version 5.0. The System folder. A typical path is C:\Windows\System32.
FileSystem.BrowseForFolder.BSF_PROGRAMFILES	= 0x26; // (38). Version 5.0. Program Files folder. A typical path is C:\Program Files.
FileSystem.BrowseForFolder.BSF_MYPICTURES		= 0x27; // (39). My Pictures folder. A typical path is C:\Users\username\Pictures.
FileSystem.BrowseForFolder.BSF_PROFILE		= 0x28; // (40). Version 5.0. User's profile folder.
FileSystem.BrowseForFolder.BSF_SYSTEMx86		= 0x29; // (41). Version 5.0. System folder. A typical path is C:\Windows\System32, or C:\Windows\Syswow32 on a 64-bit computer.

FileSystem.BrowseForFolder.BSF_PROGRAMFILESx86	= 0x30; // (48). Version 6.0. Program Files folder. A typical path is C:\Program Files, or C:\Program Files (X86) on a 64-bit computer.


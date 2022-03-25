const fs =require('fs');
const path = require('path');
const hx = require('hbuilderx');
const { spawn, exec } = require('child_process');

const os = require('os');
const osName = os.platform();

// HBuilderX内置的keytool
const hx_keytool = path.join(hx.env.appRoot, "plugins", "jre", "bin", "keytool");

const viewID = "android.key";
const viewTitle = "Android证书";

/**
 * @description 获取keytool命令
 */
function getKeytool() {
    let cmd = osName == "win32" ? "where keytool" : "which keytool";
    let built_in_keytool;
    if (fs.existsSync(hx_keytool)) {
        built_in_keytool = hx_keytool;
    };
    return new Promise((resolve, reject) => {
        exec(cmd, function(error, stdout, stderr) {
            if (error) {
                if (built_in_keytool) {
                    resolve(built_in_keytool);
                } else {
                    createOutputChannel("未查找到keytool相关工具，请在当前电脑安装JDK，并配置环境变量。", "error");
                    createOutputChannel("如果当前电脑已安装JDK，请确保已将JDK安装路径加入到环境变量中。", "error");
                    createOutputChannel("配置系统环境变量后，请重启HBuilderX。", "error");
                    createOutputChannel("Oracle JDK下载地址：https://www.oracle.com/java/technologies/downloads/", "info");
                    reject('error');
                };
            };
            resolve('keytool');
        });
    });
};


/**
 * @description 以当前时间生成文件名
 * @return {String}
 */
function getFileNameForDate() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let date = now.getDate();
    let hour = now.getHours();
    let minu = now.getMinutes();
    let se = now.getSeconds();
    month = month + 1;
    if (month < 10) month = "0" + month;
    if (date < 10) date = "0" + date;
    let time = year + month + date + hour + minu + se;
    return time;
};


/**
 * @description 创建输出控制台
 * @param {String} msg
 * @param {String} msgLevel (warning | success | error | info), 控制文本颜色
 */
function createOutputChannel(msg, msgLevel = 'info') {
    let output = hx.window.createOutputView({
        id: viewID,
        title: viewTitle
    });
    output.show();

    if (['warning', 'success', 'error', 'info'].includes(msgLevel)) {
        output.appendLine({line: msg, level: msgLevel});
    } else {
        output.appendLine(msg);
    };
};

/**
 * @description 创建输出控制台, 支持文件链接跳转
 * @param {String} msg
 * @param {String} msgLevel (warning | success | error | info), 控制文本颜色
 * @param {String} viewID 目前的值仅为: 'log'
 * @param {String} runDir 程序执行目录
 */
function createOutputViewForHyperLinks(msg, msgLevel='info', runDir) {
    let outputView = hx.window.createOutputView({
        id: viewID,
        title: viewTitle
    });
    outputView.show();

    let filepath, start;
    if (msg.includes('Test results written to:')) {
        start = "Test results written to: ".length;
        let tmp = msg.substring(start, msg.length);
        filepath = path.resolve(runDir, tmp);
    };
    outputView.appendLine({
        line: msg,
        level: msgLevel,
        hyperlinks:[
            {
                linkPosition: {
                    start: start,
                    end: msg.length
                },
                onOpen: function() {
                    filepath = filepath.trim();
                    hx.workspace.openTextDocument(filepath);
                    setTimeout(function() {
                        hx.commands.executeCommand('editor.action.format');
                        hx.commands.executeCommand('workbench.action.files.save');
                    }, 100);
                }
            }
        ]
    });
};

async function applyEdit(text) {
    await hx.commands.executeCommand('workbench.action.files.newUntitledFile');
    await hx.window.getActiveTextEditor().then((editor) => {
        let workspaceEdit = new hx.WorkspaceEdit();
        let edits = [];
        edits.push(new hx.TextEdit({
            start: 0,
            end: 0
        }, text));
        workspaceEdit.set(editor.document.uri, edits);
        hx.workspace.applyEdit(workspaceEdit);
    });
};

/**
 * @description 对话框
 *     - 插件API: hx.window.showMessageBox
 *     - 已屏蔽esc事件，不支持esc关闭弹窗；因此弹窗上的x按钮，也无法点击。
 *     - 按钮组中必须提供`关闭`操作。且关闭按钮需要位于数组最后。
 * @param {String} title
 * @param {String} text
 * @param {String} buttons 按钮，必须大于1个
 * @return {String}
 */
function hxShowMessageBox(title, text, buttons = ['关闭']) {
    return new Promise((resolve, reject) => {
        if ( buttons.length > 1  && (buttons.includes('关闭') || buttons.includes('取消')) ) {
            if (osName == 'darwin') {
                buttons = buttons.reverse();
            };
        };
        hx.window.showMessageBox({
            type: 'info',
            title: title,
            text: text,
            buttons: buttons,
            defaultButton: 0,
            escapeButton: -100
        }).then(button => {
            resolve(button);
        }).catch(error => {
            reject(error);
        });
    });
};

/**
 * @description 命令行运行
 * @param {String} cmd - 命令行运行的命令
 */
function runCmd(cmd = '') {
    return new Promise((resolve, reject) => {
        var workerProcess = exec(cmd, function(error, stdout, stderr) {
            if (error) {
                createOutputChannel(`命令运行错误: ${error}\n`, 'error');
                reject('run_error');
            };
            if (stdout.length != 0) {
                createOutputChannel(`${stderr}\n`, 'info');
            };
            if (stderr.length != 0) {
                createOutputChannel(`${stderr}\n`, 'warning');
            };
        });
        workerProcess.on('exit', function (code) {
            if (code == 0) {
                resolve('run_end');
            } else {
                reject('run_error');
            };
        });
    });
};

/**
 * @description 运行命令
 */
function runCmdForShow(cmd, opts = {}) {
    opts = Object.assign({
        stdio: 'pipe',
        cwd: process.cwd()
    }, opts);

    const shell = process.platform === 'win32' ? {cmd: 'cmd',arg: '/C'} : {cmd: 'sh',arg: '-c'};
    var ls = spawn(shell.cmd, [shell.arg, cmd], opts);;

    var msg = '';
    ls.stdout.on('data', function(data) {
        msg = msg + data;
    });

    ls.stderr.on('data', function(data) {
        msg = msg + data;
        if (data.includes('输入密钥库口令')) {
            createOutputChannel("查看证书，必须提供证书密码。\n", "error");
        };
    });

    ls.on('exit', function(code) {
        if (msg.includes("SHA1") && msg.includes("SHA256")) {
            createOutputChannel("获取证书信息成功。", "success");
            applyEdit(msg);
        } else if (msg.includes("password was incorrect")) {
            createOutputChannel("证书查看密码错误。", "error");
        } else {
            createOutputChannel(msg, "info");
        };
    });
};

module.exports = {
    hxShowMessageBox,
    runCmd,
    runCmdForShow,
    getKeytool,
    createOutputChannel,
    getFileNameForDate
};

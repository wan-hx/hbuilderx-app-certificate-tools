const hx = require('hbuilderx');
const fs = require('fs');
const process = require('process');
const path = require('path');
const {
    runCmd,
    getKeytool,
    getFileNameForDate,
    hxShowMessageBox,
    createOutputChannel
} = require('../utils.js');

let formItems = [
    {
        type: "radioGroup",label: "密钥算法名称",name: "keyalg",value: "RSA",
        items: [
            {label: "RSA",id: "RSA"},{label: "DSA",id: "DSA"}
        ]
    },
    {
        type: "radioGroup",label: "证书文件后缀",name: "format",value: "keystore",
        items: [
            {label: "keystore",id: "keystore"},{label: "key",id: "key"},{label: "jks",id: "jks"}
        ]
    },
    {type: "fileSelectInput",name: "saveDir",label: "证书位置",placeholder: 'keystore - 生成的证书本地存储目录', mode: "folder"},
    {type: "input",name: "keypass",label: "密钥口令",placeholder: "keypass - 密钥口令"},
    {type: "input",name: "storepass",label: "密钥库口令",placeholder: "storepass - 密钥库口令，建议跟keypass保持一致"},
    {type: "input",name: "keysize",label: "密钥位大小",placeholder: 'keysize - 通常为2048等', "value": "2048"},
    {type: "input",name: "alias",label: "证书别名",placeholder: 'alias - 证书别名，建议使用英文字母和数字，如testalias'},
    {type: "input",name: "validity",label: "证书有效天数",placeholder: 'validity - 证书有效期，单位：天；时间应设置长一点，避免过期，如36500', "value": "36500"},
    {type: "input",name: "CN",label: "名字",placeholder: "您的姓氏与名字"},
    {type: "input",name: "OU",label: "组织单位名称",placeholder: "您的组织单位名称，通常为您公司的名称"},
    {type: "input",name: "O",label: "组织名称",placeholder: "您的组织名称，通常为您公司的名称"},
    {type: "input",name: "C",label: "国家/地区",placeholder: "您单位所在的双字母国家或地区，比如CN；通常为CN", "value": "CN"},
    {type: "input",name: "ST",label: "省/市/自治区",placeholder: "您所在的省/市/自治区名称，比如shanghai"},
    {type: "input",name: "L",label: "所在城市",placeholder: "您所在的城市或区域名称，比如shanghai"}
];

// 此处转换为{}, 方便hx.window.showFormDialog validate
let checkformItems = {};
for (let s of formItems) {
    let name = s["name"];
    checkformItems[name] = s["label"];
};

/**
 * @description 验证用户填写数据
 * @param {Object} formData
 */
let askkeysize = false;
let askValidity = false;
let askPass = false;
async function goValidate(formData, that) {
    // 检查：所有项不能为空
    for (let v in formData) {
        let info = (formData[v]).trim();
        let label = checkformItems[v];
        if (info == "" || !info) {
            that.showError(`${label} 不能为空或填写错误`);
            return false;
        };
    };

    let {validity, keysize, keypass, storepass, saveDir} = formData;

    // 检查：密码长度
    if ((keypass.trim()).length < 6 || (storepass.trim()).length < 6) {
        that.showError(`密码长度，输入不能少于6位`);
        return false;
    };

    // 密码检查
    if (keypass && storepass && !askPass) {
        if (storepass != keypass && keypass.trim() && storepass.trim()) {
            let passMsg = `建议storepass和keypass设置一致。\n\nHBuilderX APP打包要求这两个密码一致。\n\n如果您已了解，请忽略。`;
            let passBtn = await hxShowMessageBox("提醒", passMsg,  ["我要修改", "不需要修改"]).then( btn => {
                return btn;
            });
            if (passBtn == "不需要修改") { askPass = true };
            return askPass;
        };
    };

    // 检查：有效天数
    if (validity) {
        let isNum = /^\+?[1-9][0-9]*$/.test(validity);
        if (!isNum) {
            that.showError(`证书有效天数， 必须为数字，且必须为整数。`);
            return false;
        };
        if (parseInt(validity) < 3650 && !askValidity) {
            let validityBtn = await hxShowMessageBox("提醒", "validity - 证书有效天数，看起来有点少，建议设置为36500。", ["我要修改", "不需要修改"]).then( btn => {
                return btn;
            });
            if (validityBtn == "不需要修改") { askValidity = true };
            return askValidity;
        }
    };

    // 检查：算法秘钥长度
    if (!askkeysize && !["56","168","256","1024","2048"].includes(keysize)) {
        let keysizeBtn = await hxShowMessageBox("提醒", "keysize秘钥长度，可能不是有效的值。RSA的算法长度为2048。", ["我要修改", "不需要修改"]).then( btn => {
            return btn;
        });
        if (keysizeBtn == "不需要修改") { askkeysize = true };
        return askkeysize;
    };

    // 检查：目录
    if (saveDir) {
        try{
            let saveDirInfo = fs.statSync(saveDir);
            if (!saveDirInfo.isDirectory()) {
                that.showError(`路径 ${saveDir} 必须是目录，请重新填写。`);
                return false;
            };
        }catch(e){
            that.showError(`路径 ${saveDir} 不存在。`);
            return false;
        };
    };

    return true;
};


/**
 * @description hx.window.showFormDialog onchange
 * @param {Object} field
 * @param {Object} value
 * @param {Object} formData
 */
function goChange(field, value, formData) {
    let {keypass, storepass, saveDir, validity, keysize} = formData;

    // 算法检查
    if (field == "keyalg" && value == "DSA") {
        let keyalgMsg = `HBuilderX APP云端打包默认会添加V1/V2签名，已知V1签名不支持2048位的DSA算法，使用2048-bit DSA key云端打包可能失败。<a href="https://ask.dcloud.net.cn/article/35777">参考</a>。\n\n如果您不是用于HBuilderX App打包或已进行配置，请忽略。`;
        hxShowMessageBox("提醒", keyalgMsg, ["我知道了"]);
    };
    if (!["keypass", "storepass", "saveDir", "validity", "keysize"].includes(field)) return;
};

/**
 * @description 创建android证书
 */
async function androidCertificateCreate() {
    // 获取keytool路径，如果本地未安装，则采用HBuilderX内置的keytool
    let keytool = await getKeytool();
    if (keytool == "error") return;

    let footer = '<p style="color: #a0a0a0; font-size: 13px;">插件开发不易，请作者喝杯可乐 <a href="https://ext.dcloud.net.cn/plugin?name=app-certificate-tools">赞助</a></p>';

    let userInfo = await hx.window.showFormDialog({
        formItems: formItems,
        title: "Android证书生成可视化界面",
        subtitle: "调用java keytool生成证书。如果您是用来上架应用市场，乱填会影响上架，请规范填写。",
        footer: footer,
        width: 600,
        height: 480,
        submitButtonText: "确定(&S)",
        cancelButtonText: "取消(&C)",
        validate: function(formData) {
            let checkResult = goValidate(formData, this);
            return checkResult;
        },
        onChanged: function(field, value, formData) {
            goChange(field, value, formData);
        }
    }).then((res) => {
        return res;
    }).catch(error => {
        console.log(error);
    })

    if (userInfo == undefined) return;

    let cmd = `keytool -genkey `;
    let {saveDir,format,alias,keyalg,keypass,keysize,storepass,keystore,validity,C,CN,L,O,OU,ST} = userInfo;

    let keystoreFile = `${alias}.${format}`;
    if (fs.existsSync(path.join(saveDir, keystoreFile))) {
        let time = getFileNameForDate();
        keystoreFile = `${alias}_${time}.${format}`;
    };
    let outputFilePath = path.join(saveDir, keystoreFile);
    cmd = cmd + ` -dname "CN=${CN}, OU=${OU}, O=${O}, L=${L}, ST=${ST}, C=${CN}"`;
    cmd = cmd + ` -alias ${alias} -keyalg ${keyalg} -keysize ${keysize} -validity ${validity} -keypass ${keypass} -storepass ${storepass} -keystore ${outputFilePath} -noprompt`;

    // 控制台打印命令
    if (keytool != 'keytool') {
        createOutputChannel("备注：当前操作，使用的是HBuilderX内置Java keytool工具。\n", "info");
        let keytoolDir = path.dirname(keytool);
        process.chdir(keytoolDir);
    } else {
        createOutputChannel("备注：当前操作，使用的是电脑自身已安装的Java keytool工具。\n", "info");
    }
    createOutputChannel(`运行的命令为：${cmd} \n`);

    let result = await runCmd(cmd);
    console.error('Android证书生成，命令行运行结果: ', result);

    if (result == "run_end") {
        createOutputChannel(`Android证书生成成功。路径：${outputFilePath}`, 'success');
        createOutputChannel(`提示：请妥善保存您的证书、密码、以及证书生成命令等信息，丢失后无法找回。\n`, 'info');
        hxShowMessageBox("Android证书生成成功", `路径：${outputFilePath} \n\n 注意：\n1. 请妥善保存您的证书、密码、以及证书生成命令等信息，丢失后无法找回。 \n2. 证书有效期为${validity}天。`, ["我知道了"]);
    } else {
        createOutputChannel(`Android证书生成失败。请根据错误提示解决问题。`, 'error');
    }
};

module.exports = androidCertificateCreate;

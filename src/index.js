#!/usr/bin/env node

/**
 * 声明执行环境
 */

const fs = require('fs');
const path = require('path');
const needle = require('needle');
const process = require('process');

// "NDEyLWY1YzEtNCUyMDIxMDkwNDA5NDIwOV9fMl9fM19fMTAyX19kZWZhdWx0XzQ5ZTQ0";

// 匹配开关的正则表达式
const regex = /(.*?)(checkVariation|checkVariationAsync|variation|variationAsync)\((\s*)([\"|\'])(.*?)[\"|\'](.*?)/g;

// 请求开关地址
const defaultURL = "https://ffc-api-ce2-dev.chinacloudsites.cn";

const defaultRequestURL = "api/public/feature-flag";

// 匹配到的开关名字
let featureFlags = [];

// 当前正在使用的开关列表
let activeFeatureFlags = [];

let excludedDirectories = ['node_modules', '.git'];
let excludedFileNames = ['package.json', 'package-lock.json', 'readme.md', '.gitignore', 'LICENSE'];
let excluded = [...excludedDirectories, ...excludedFileNames];

(async () => {

    // 读取请求参数
    const secretKey = 'YTE3LTJjMTktNCUyMDIxMTAxMTIwMDQ1NF9fNV9fMjhfXzU2X19kZWZhdWx0X2Q2OWUz' //process.env.npm_config_secret_key;

    if(secretKey) {

        let baseURL = process.env.npm_config_server_url;

        if(baseURL) {

            // 判断输入的 url 是否以 "/" 结尾，以 "/" 结尾则
            baseURL = baseURL.endsWith("/") ? baseURL + defaultRequestURL : baseURL + "/" + defaultRequestURL;

        } else {
            let messageStr = `未配置服务器地址...\n将使用默认的服务器地址...\n默认服务器地址为：${defaultURL}`;
            console.log('\x1B[33m%s\x1B[39m', messageStr);

            baseURL = defaultURL + "/" + defaultRequestURL;
        }

        activeFeatureFlags = [...await requestActiveFeatureFlags(secretKey, baseURL)];

        // 获取当前正在执行项目的路径
        let executingPath = process.cwd();
    
        // 要遍历的文件夹
        let ergodicPath = path.resolve(executingPath);
    
        // 调用文件遍历方法
        ergodicFiles(ergodicPath);
    
        // 等待文件扫描完成
        let timer = setInterval(() => {
            featureFlags.length && (() => {
                clearInterval(timer);
    
                // 去重
                let featureFlagsArr = [...new Set(featureFlags)];
                // 查找不存在的开关名字
                let allDeletedFeatureFlags = findDeleteFeatureFlags(featureFlagsArr, activeFeatureFlags);
                
                console.log("\n扫描完毕，被移除的开关列表\n");

                allDeletedFeatureFlags.forEach((featureFlag, index) => {
                    console.log('\x1B[32m%s\x1B[39m', `\t${index + 1}：${featureFlag}`);
                })
            })();
        }, 500)
    } else {
        console.log('\x1B[31m%s\x1B[39m', "请配置 secret_key...");
    }
})();

/** 
 * 遍历文件夹
 * @param ergodicPath 需要遍历的文件路径 
 */  
function ergodicFiles(ergodicPath) {

    //根据文件路径读取文件，返回文件列表  
    fs.readdir(ergodicPath, (err,files) => {
        
        (!err) && (() => {
            //遍历读取到的文件列表
            files.forEach(filename => {

                // 排除 node_modules 文件夹
                (excluded.findIndex(f => f === filename) === -1) && (() => {

                    //获取当前文件的绝对路径  
                    let filedir = path.join(ergodicPath,filename);

                    //根据文件路径获取文件信息，返回一个fs.Stats对象  
                    fs.stat(filedir, (eror,stats) => {

                        !eror && (() => {
                            let isFile = stats.isFile(); 
                            let isDir = stats.isDirectory();
                            
                            isFile && readFileContent(filedir);

                            // 递归遍历文件夹
                            isDir && ergodicFiles(filedir);
                        })(); 
                    }) 
                })();
            });  
        })(); 
    }); 
}   
/**
 * 读取文件内容
 * @param {*} filedir 文件地址
 */
function readFileContent(filedir) {
    fs.readFile(filedir, "utf-8", (error, data) => {
        !error && (() => {
            let matchResult = data.match(regex);
            
            matchResult && (featureFlags = [...featureFlags, ...sortoutMatchResult(matchResult)]);
        })();
    })
}

/**
 * 处理匹配结果
 * @param {*} result 正则匹配成功的开关名字列表
 * @returns 处理后的开关列表
 */
function sortoutMatchResult(result) {

    let featureFlags = [];

    for(let i = 0; i < result.length; i++) {

        // 去掉字符串中的空白字符，替换字符串中的单引号为双引号，按双引号切割字符串
        let splitResult = result[i].replace(/\s/g, "").replace(/\'/g, "\"").split("\"");

        splitResult.length && featureFlags.push(splitResult[1]);
    }

    return featureFlags;
}

/**
 * 查找不存在的开关名字
 * @param {*} useFeatureFlags   当前所有文件使用的开关列表
 * @param {*} allFeatureFlags   请求下来的正在使用的所有开关
 */
function findDeleteFeatureFlags(useFeatureFlags, allFeatureFlags) {
    let result = [];
    useFeatureFlags.map(featureFalg => !allFeatureFlags.includes(featureFalg) && (result[result.length] = featureFalg));
    return result;
}

/**
 * 请求正在使用的所有开关
 * @returns 
 */
function requestActiveFeatureFlags(secretKey, url) {
    return new Promise((resolve) => {
        needle.get(`${url}?envSecret=${secretKey}`, (error, response) => {
            if (!error && response.statusCode == 200) {
                resolve(response.body);
            } else {
                resolve([]);
            }
        })
    })
}
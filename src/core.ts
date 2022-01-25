#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exit } from 'process';
import needle from 'needle';
import lineByLine from 'n-readlines';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import config from './ffcconfig.json';
import winston, { format } from 'winston';

const { combine, timestamp, printf, colorize, align } = format;

const myFormat = printf( (info) => {
    return `${info.level} ${info.timestamp}: ${info.message}`;
  });

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    format.errors({ stack: true }),
    colorize(),
	timestamp(),
    align(),
    myFormat
  ),
  transports: [
    new winston.transports.Console(),
    //new winston.transports.File({ filename: 'ffc-code-refs.log' }),
  ],
});

interface IConfig {
    envSecret: string,
    apiUrl: string,
    excluded: string[],
    fileExtensions: string[],
    numberOfContextLines: number,
    exitWithErrorWhenStaleFeatureFlagFound: boolean,
    logErrorOnly: boolean
}

interface IFeatureFlagStats {
    filePath: string,
    lineNumber: number,
    featureFlag: string,
    line: string,
    preContextLines: string[],
    postContextLines: string[]
}
// the regex to match feature flags
const regex = /(.*?)(checkVariation|checkVariationAsync|variation|variationAsync)\((\s*)([\"|\'])(.*?)[\"|\'](.*?)/g;

let defaultConfig: IConfig = config;


/**
 * call this method to do logs, it calls winston internally
 * @param {*} param it should have the following type: {level: string, message: string}
 * @returns 
 */
function log(param: any) {
    if (defaultConfig.logErrorOnly && param.level !== 'error') {
        return;
    }

    logger.log(param);
}

/**
 * Return currently active feature flags
 * @returns 
 */
function requestActiveFeatureFlags(secretKey: string, url: string): Promise<any> {
    var options = {
        headers: { 'envSecret': secretKey }
      };

    return new Promise((resolve) => {
        needle.get(`${url}`, options, (error, response) => {
            if (!error && response.statusCode == 200 && !!response.body && !!response.body.data) {
                resolve(response.body.data);
            } else {
                log({level: 'error', message: error?.message || 'error while requesting active feature flags'});
            }
        })
    })
}

/**
 * Scan path and return the stats
 * @param {*} path the path of the directory or file
 */
 function scan(path: string): IFeatureFlagStats[] {
    // 保存文件路径
    let paths = new Array();
    let featureFlagsStats: IFeatureFlagStats[] = [];

    paths.push(path);
    log({level: 'info', message: 'Scanning'});
    while(paths && paths.length !== 0) {
        let path = paths.pop();

        log({level: 'info', message: path});
        
        let children: string[] = [];

        try {
            // 读取路径下的子元素
            children = fs.readdirSync(path);
        } catch(e) {
            
            // 读取权限不足的文件
            continue;
        }

        // 遍历子元素
        for(let child of children) {
            if(defaultConfig.excluded.findIndex((p) => p === child) > -1) {
                continue;
            }

            // 构造文件完整路径
            let fullPath = `${path}/${child}`;
            let fileInfo;

            try {
                // 读取文件信息
                fileInfo = fs.statSync(fullPath);
            } catch(e) {
                continue;
            }

            /**
             * 判断当前文件是否是文件夹
             *      是：保存文件路径到 paths，下一次循环遍历
             *      否：读取文件内容
             */
            if(fileInfo.isDirectory()) {
                paths.push(fullPath);
            } else {
                // 分割文件名
                let fileNameSplit = child.split(".");
                // 截取文件后缀
                let suffix = fileNameSplit[fileNameSplit.length - 1];

                if(defaultConfig.fileExtensions.length === 0 || defaultConfig.fileExtensions.includes(suffix)) {
                    featureFlagsStats = [...featureFlagsStats, ...readFileContent(fullPath)];
                }
            }
        }
    }

    return featureFlagsStats;
}

function hasIgnoreLineComment(lineStr: string): boolean {
    return !!lineStr && lineStr.replace(/\s/g, '').match(/ffcscanignore/ig) !== null;
}

function hasDisableComment(lineStr: string): boolean {
    return !!lineStr && lineStr.replace(/\s/g, '').match(/ffcscandisable/ig) !== null;
}

function hasEnableComment(lineStr: string): boolean {
    return !!lineStr && lineStr.replace(/\s/g, '').match(/ffcscanenable/ig) !== null;
}

/**
 * 读取文件内容 同步
 * @param {*} filedir 文件地址
 */
 function readFileContent(filePath: string): IFeatureFlagStats[] {
    const liner = new lineByLine(filePath);
    const linesStats: IFeatureFlagStats[] = [];

    let line;
    let lineNumber = 1;
    
    const preContextLines: string[] = [];
    defaultConfig.numberOfContextLines

    let isDisableComment = false;
    let isIgnoreLineComment = false; // only the line directly below the comment would be ignored
    while (line = liner.next()) {
        const lineStr = line.toString('utf8').replace(/\r?\n|\r/g, "").trim();

        const matchRegex = lineStr.match(regex);

        // collect context lines
        if (defaultConfig.numberOfContextLines > 0) {
            if (preContextLines.length >= defaultConfig.numberOfContextLines) {
                if (!matchRegex) { 
                    preContextLines.shift();
                }   
            }

            if (!matchRegex) { 
                preContextLines.push(lineStr);
            }

            for(let stat of linesStats) {
                if (stat.postContextLines.length < defaultConfig.numberOfContextLines) {
                    stat.postContextLines.push(lineStr);
                } 
            }
        }

        if (isDisableComment) {
            if (!hasEnableComment(lineStr)) {
                lineNumber++;
                continue;
            }                                                                                                                                                                                                                                                                                       

            isDisableComment = false;
        }

        isDisableComment = hasDisableComment(lineStr);
        if (isDisableComment) {
            lineNumber++;
            continue;
        }

        if (isIgnoreLineComment) {
            isIgnoreLineComment = hasIgnoreLineComment(lineStr);
        } else {
            isIgnoreLineComment = hasIgnoreLineComment(lineStr);

            if (matchRegex) {
                let splitResult = lineStr.replace(/\s/g, "").replace(/\'/g, "\"").split("\"");
                linesStats.push({
                    filePath,
                    lineNumber,
                    featureFlag: splitResult.length > 0 ? splitResult[1] : '',
                    line: lineStr,
                    preContextLines: [...preContextLines],
                    postContextLines: []
                });
            }
        }

        lineNumber++;
    }

    //  log({level: '', message: `Scanned file: ${filePath} with following stale feature flags: [${linesStats.map(l => l.featureFlag).join(';')}]`});


    return linesStats;
}

/**
 * find stale feature flags
 * @param {*} featureFlagsInCode   all feature flags used in the code
 * @param {*} activeFeatureFlags   all active feature flag retrived from ffc
 */
 function findStaleFeatureFlags(featureFlagsInCode, activeFeatureFlags) {
    return featureFlagsInCode.filter(f => !activeFeatureFlags.includes(f.featureFlag));
}

async function buildConfig() {
    try {
        const argv = yargs(hideBin(process.argv))
            .option('config', {
                alias: 'cfg',
                type: 'string',
                description: 'the path of the config file'
            })
            .help()
            .alias('help', 'h').argv;

        const configPath = path.resolve(argv['config'] === null || argv['config'] === undefined || argv['config'] === '' ? process.cwd() + '/ffcconfig.json' : argv['config']);
        const config = await import(configPath);

        if (config) {
            defaultConfig = Object.assign({}, defaultConfig, config, {
                excluded: [...defaultConfig.excluded, ...config.excluded],
                fileExtensions: [...defaultConfig.fileExtensions, ...config.fileExtensions],
                apiUrl: config.apiUrl || defaultConfig.apiUrl,
                numberOfContextLines: config.numberOfContextLines || defaultConfig.numberOfContextLines,
                exitWithErrorWhenStaleFeatureFlagFound: config.exitWithErrorWhenStaleFeatureFlagFound || defaultConfig.exitWithErrorWhenStaleFeatureFlagFound,
                logErrorOnly: config.logErrorOnly == null || config.logErrorOnly === undefined ? defaultConfig.logErrorOnly  : config.logErrorOnly,
            })
        } 
    } catch (err: any) {
        log({ level: 'error', message: err.message});
    }
}

export default async function start (): Promise<any> {
    await buildConfig();

    const secretKey = defaultConfig.envSecret; // TODO replace with integration token

    if(!secretKey) {
        log({ level: 'error', message: 'Please set environment secret'});
        exit(-1);
    }

    let baseURL = defaultConfig.apiUrl;
    const ffListEndPoint = 'api/public/feature-flag';

    if(baseURL) {
        baseURL = baseURL.endsWith("/") ? baseURL + ffListEndPoint : baseURL + "/" + ffListEndPoint;
    } else {
       log({ level: 'error', message: 'Please set apiUrl'});
       exit(-1);
    }

    const activeFeatureFlags = [...await requestActiveFeatureFlags(secretKey, baseURL)];
    
    let rootPath = process.cwd(); //path.resolve(process.cwd());
    const featureFlagsInCode = scan(rootPath);
    if (featureFlagsInCode.length > 0) {
        // remove duplicats
        let featureFlagsArr = Array.from(new Set(featureFlagsInCode).values());
        // find stale feature flags
        let staleFeatureFlags = findStaleFeatureFlags(featureFlagsArr, activeFeatureFlags.map(f => f.keyName));
        
        if (staleFeatureFlags.length > 0) {
            log({ level: 'info', message: 'Done, found following stale feature flags:'});
            log({ level: 'info', message: JSON.stringify(staleFeatureFlags, null, 4)});
            
            if (defaultConfig.exitWithErrorWhenStaleFeatureFlagFound) {
                exit(-1);
            }

            return staleFeatureFlags;
        } else {
            log({ level: 'info', message: 'Done, no stale feature flags found in the current project'});
        }
    } else {
        log({ level: 'info', message: 'Done, no stale feature flags found in the current project'});
    }

    return [];
}

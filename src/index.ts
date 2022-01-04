import fs from 'fs';
import { exit } from 'process';
import needle from 'needle';
import lineByLine from 'n-readlines';
import config from './ffcconfig.json';

const projectRootPath = '../../../';

interface IConfig {
    envSecret: string,
    apiUrl: string,
    excluded: string[],
    fileExtensions: string[],
    numberOfContextLines: number,
    silence: boolean,
    exitWithErrorWhenStaleFeatureFlagFound: boolean
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
                resolve([]);
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
    while(paths && paths.length !== 0) {

        let path = paths.pop();

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

                if(defaultConfig.fileExtensions.includes(suffix)) {
                    featureFlagsStats = [...featureFlagsStats, ...readFileContent(fullPath)];
                }
            }
        }
    }

    return featureFlagsStats;
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
        lineNumber++;
    }

    if (!defaultConfig.silence && linesStats.length > 0) {
        console.log(`Scanned file: ${filePath} with following stale feature flags: [${linesStats.map(l => l.featureFlag).join(';')}]`);
    }

    return linesStats;
}

/**
 * find stale feature flags
 * @param {*} featureFlagsInCode   all feature flags used in the code
 * @param {*} activeFeatureFlags   all active feature flag retrived from ffc
 */
 function findStaleFeatureFlags(featureFlagsInCode, activeFeatureFlags) {
    return featureFlagsInCode.filter(f => !activeFeatureFlags.includes(f));
}

async function start (): Promise<void|string> {
    const secretKey = defaultConfig.envSecret; // TODO replace with integration token

    if(!secretKey) {
        console.log('Please set environment secret');
        exit(-1);
    }

    let baseURL = defaultConfig.apiUrl;
    const ffListEndPoint = 'api/public/feature-flag';

    if(baseURL) {
        baseURL = baseURL.endsWith("/") ? baseURL + ffListEndPoint : baseURL + "/" + ffListEndPoint;
    } else {
       console.log('Please set apiUrl');
       exit(-1);
    }

    const activeFeatureFlags = [...await requestActiveFeatureFlags(secretKey, baseURL)];
    
    //let rootPath = './tests'//path.resolve(process.cwd());

    const featureFlagsInCode = scan(projectRootPath);

    if (featureFlagsInCode.length > 0) {
        // remove duplicats
        let featureFlagsArr = Array.from(new Set(featureFlagsInCode).values());
        // find stale feature flags
        let staleFeatureFlags = findStaleFeatureFlags(featureFlagsArr, activeFeatureFlags.map(f => f.keyName));
        
        if (staleFeatureFlags.length > 0) {
            console.log("Done, found following stale feature flags:");
            console.log(JSON.stringify(staleFeatureFlags, null, 4));

            if (defaultConfig.exitWithErrorWhenStaleFeatureFlagFound) {
                exit(-1);
            }
        } else {
            console.log("Done, no stale feature flags found in the current project");
        }
    }
}

(async () => {
    try {
        const configPath = projectRootPath + 'ffcconfig.json';
        const config = await import(configPath);

        if (config) {
            defaultConfig = Object.assign({}, defaultConfig, config, {
                excluded: [...defaultConfig.excluded, ...config.excluded]
            })
        } 
    } catch (err) {
        console.log(process.cwd());
        console.log('error while loading the config file', err);
    }

    start();
})();

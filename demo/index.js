/**
 * javascript  ---> text/javascript
 * html ----> text/html
 * typescript ---> text/plain
 */
(async () => {

    let allFeatureFlags = await requestAAllFeatureFlags();

    let fileInput = document.getElementById("file");

    let regex = /(.*?)checkVariation\((\s*)([\"|\'])(.*?)[\"|\'](.*?)/g;
    let regexAsync = /(.*?)checkVariationAsync\((\s*)([\"|\'])(.*?)[\"|\'](.*?)/g;
    
    let timer = null;
    let featureFlags = [];

    fileInput.addEventListener("change", (event) => {
        const fileList = event.target.files;

        fileList.length && (() => {
            for(let i = 0; i < fileList.length; i++) {
                let fileObj = fileList[i];
    
                fileObj.type === "text/javascript" && (() => {

                    var FR = new FileReader();
        
                    FR.onloadend = (e) => {
                        let content  = e.currentTarget.result;

                        let matchResult = content.match(regex);
                        let matchResultAsync = content.match(regexAsync);

                        matchResult && (featureFlags = [...featureFlags, ...sortoutMatchResult(matchResult)]);
                        matchResultAsync && (featureFlags = [...featureFlags, ...sortoutMatchResult(matchResultAsync)]);
                    }
        
                    FR.readAsText(fileObj);
                })();
            }
        })();
        
        timer = setInterval(() => {
            featureFlags.length && (() => {
                fileInput = null;
                clearInterval(timer);

                // 去重
                let featureFlagsArr = [...new Set(featureFlags)];
                // 查找不存在的开关名字
                let allDeletedFeatureFlags = findDeleteFeatureFlags(featureFlagsArr, allFeatureFlags);
                
                let ulNode = document.getElementById("deleteFeatureFlags");

                let liStr = "";

                allDeletedFeatureFlags.forEach((item) => {
                    liStr += "<li>" + item +"</li>";
                })

                ulNode.innerHTML = liStr;
            })();
        }, 500)
    })
})();

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

    useFeatureFlags.map(featureFalg => !allFeatureFlags.includes(featureFalg) && (result[result.length] = featureFalg))

    return result;
}

/**
 * 请求正在使用的所有开关
 * @returns 
 */
function requestAAllFeatureFlags() {
    return new Promise(async (resolve, reject) => {
        const baseURL = "https://ffc-api-ce2-dev.chinacloudsites.cn/public/api/feature-flag/archived";
        const secretKey = "NDEyLWY1YzEtNCUyMDIxMDkwNDA5NDIwOV9fMl9fM19fMTAyX19kZWZhdWx0XzQ5ZTQ0";

        try {
            const response = await fetch(`${baseURL}?envSecret=${secretKey}`);
            const data = await response.json();

            resolve([...data.map(item => item.ff.keyName)]);
        } catch(error) {
            reject([]);
        }
    })
}
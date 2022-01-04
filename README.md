# ffc-code-refs-core
Command line program for generating flag code references. 



## 一、安装

1. 克隆或者下载当前文件
2. 安装依赖 npm install
3. 在项目中安装：npm install file:文件路径（文件路径包含 src 目录）
4. 在项目 package.json 文件中配置运行命令，运行该程序的命令为 scan

```json
{
  "scripts": {
    "scan": "scan"
  }
}
```



## 二、参数

- --secret_key：配置请求开关列表的 secretKey，必须配置
- --server_url：服务器的请求地址，不配置使用默认地址
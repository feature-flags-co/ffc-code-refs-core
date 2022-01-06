# ffc-code-refs-core
This is a ommand line util for generating flag code references when using the feature-flags.co SaaS or Standalone project. 


## Install

Use npm to install the package into your project
  ```
  npm install ffc-code-refs-core --save-dev
  ```

In your package.json file,  add the following command:

```json
{
  "scripts": {
    "ffc-scan": "node ./node_modules/ffc-code-refs-core/dist/index.js"
  }
}
```

Add to the root directory of your project, a file ffcconfig.json with following content:
```json
{
    "envSecret": "",
    "apiUrl": "",
    "excluded": [],
    "fileExtensions": [],
    "numberOfContextLines": 0,
    "silence": true,
    "exitWithErrorWhenStaleFeatureFlagFound": false
}
```
- **envSecret**: the secret of your environment, can be find in your account
- **apiUrl**: can be empty if you are using our SaaS platform
- **excluded**: list of excluded file or directory, put the file or directory name only, path is not expected
- **fileExtensions**: the file extensions that you want to be scanned, if empty, all files will be scanned
- **numberOfContextLines**: the number of lines before and after that will be included into the report, the default value is 0
- **silence**: Will print the process if false, the default value is true
- **exitWithErrorWhenStaleFeatureFlagFound**: If true, will exit with error when any stale feature flag is found, the default value is true

If you want to specify a config file with different name or different position, you can add a parameter when running the command
```json
{
  "scripts": {
    "ffc-scan": "node ./node_modules/ffc-code-refs-core/dist/index.js --config path/to/your/config/file"
  }
}
```

## Run

```
npm run ffc-scan
```

## Note
Currently, in your project, when getting the feature flag value, the method and parameters must be on the same line in order to be recognized by the util, for example

```
FFCJsClient.variation('featureFlagKey', 'defaultResult');
```

will work, but 

```
FFCJsClient.variation(
  'featureFlagKey', 
  'defaultResult'
);
```
won't work

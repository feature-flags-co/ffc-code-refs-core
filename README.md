# ffc-code-refs-core
This is a command line util for generating flag code references when using the feature-flags.co SaaS or Standalone project. 


## Install

Use npm to install the package into your project
  ```
  npm install ffc-code-refs-core --save-dev
  ```

In your package.json file,  add the following command:

```json
{
  "scripts": {
    "ffc-code-refs": "code-refs"
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
    "exitWithErrorWhenStaleFeatureFlagFound": false,
    "logErrorOnly": true
}
```
- **envSecret**: the secret of your environment, can be found in your SaaS account, **mandatory**
- **apiUrl**: the server url, can be empty if you are using our SaaS platform,  **not mandatory**
- **entry**: then entry point, can be a list of relative or absolute paths, current path would be used if not provided **not mandatory**
- **excluded**: list of excluded file or directory, put the file or directory name only, path is not expected, **not mandatory**
- **fileExtensions**: the file extensions that you want to be scanned, if empty, all files will be scanned, **not mandatory**
- **numberOfContextLines**: the number of lines before and after that will be included into the report, the default value is 0, **not mandatory**
- **exitWithErrorWhenStaleFeatureFlagFound**: if true, will exit with error when any stale feature flag is found, the default value is true, **not mandatory**
- **logErrorOnly**: will print error logs only if true, the default value is false, **not mandatory**

If you want to specify a config file with different name or in a different position, you can add a parameter when running the command
```json
{
  "scripts": {
    "ffc-code-refs": "code-refs --config path/to/your/config/file"
  }
}
```

## Run

```
npm run ffc-code-refs
```

or directly without adding **scripts** in your package.json file 

```
npx code-refs
```

## Deal with false positive cases

Sometimes the same method name of the SDK may be used in the project, this would result to false positive cases, to avoid this, we can add ffcscan comment to ingore one line or disable a block of code, for example 

```
// ffcscan ignore
const myvar = abc.variation("abc");
```

the above comment would ignore the line directly below the comment.

```
// ffcscan disable
const myvar = abc.variation("abc");
if (myvar) {
  continue;
}
// ffcscan enable
```

The above comments will ignore all the code between them.

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

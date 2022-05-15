import * as fs from 'fs'
import * as js_yaml from 'js-yaml'


export class FileUtils {
    static readFile = (pathFile: string) => fs.readFileSync(pathFile, { encoding: 'utf-8' })
    static yamlFileToObject = (pathFile: string): { [x: string]: any } => js_yaml.load(FileUtils.readFile(pathFile)) as { [x: string]: any }
}

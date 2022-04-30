import * as pulumi from '@pulumi/pulumi'
import { PulumiCICD } from './pulumi-cicd'

export class Bootstrap {
    public readonly pulumiCICD!: PulumiCICD
    constructor (private config: pulumi.Config) {
        this.pulumiCICD = new PulumiCICD(config)
    }
}

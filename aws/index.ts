import * as pulumi from '@pulumi/pulumi'
import { Bootstrap } from './lib/0-bootstrap/index'

const PULUMI_CONFIG = new pulumi.Config()

/**********************************************************************************
Bootstrap resources
**********************************************************************************/
let bootstrap: Bootstrap | undefined

if (pulumi.getStack() === 'production') {
    bootstrap = new Bootstrap(PULUMI_CONFIG)
}

export const pulumiCICDAccessKeyId = bootstrap?.pulumiCICD.accessKeyId
export const pulumiCICDAccessKeySecret = bootstrap?.pulumiCICD.accessKeySecret
export const pulumiCICDBackendBucket = bootstrap?.pulumiCICD.backendBucketName
export const pulumiCICDSecretProviderKeyId = bootstrap?.pulumiCICD.secretProviderKeyId

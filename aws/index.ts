import * as pulumi from '@pulumi/pulumi'
import { PulumiCICD } from './lib/0-bootstrap/pulumi-cicd'
import { mainInfrastructure } from './infrastructure'

/**********************************************************************************
Resources
**********************************************************************************/
const PULUMI_CONFIG = new pulumi.Config()
const pulumiCICD = pulumi.getStack() === 'bootstrap' ? new PulumiCICD(PULUMI_CONFIG) : undefined
const infrastructure = pulumi.getStack() !== 'bootstrap' ? mainInfrastructure(PULUMI_CONFIG) : undefined


/**********************************************************************************
Outputs
**********************************************************************************/
export const pulumiCICDBackendBucket = pulumiCICD?.backendBucketName
export const pulumiCICDSecretProviderKeyId = pulumiCICD?.secretProviderKeyId
export const pulumiCICDAwsRoleGitHub = pulumiCICD?.awsRoleGitHub

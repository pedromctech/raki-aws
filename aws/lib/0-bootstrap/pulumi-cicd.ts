import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { Output } from '@pulumi/pulumi'


export class PulumiCICD {
    public readonly accessKeyId!: Output<string>
    public readonly accessKeySecret!: Output<string>
    public readonly secretProviderKeyId!: Output<string>
    public readonly backendBucketName!: Output<string>


    constructor (private readonly config: pulumi.Config) {
        const cicdUser = this.setCICDUser()
        this.setCICDUserPolicy(cicdUser)
        const accessKey = this.setCICDUserAccessKey(cicdUser)
        this.accessKeyId = accessKey.id
        this.accessKeySecret = accessKey.secret
        this.secretProviderKeyId = this.setSecretProviderKey(`${this.config.get('organizationName')}/${pulumi.getStack()}/pulumi-secret-provider`).keyId
        this.backendBucketName = this.setBackendBucket(`${this.config.get('organizationName')}-${pulumi.getStack()}-pulumi-backend`).bucket
    }


    private setCICDUser = (): aws.iam.User =>
        new aws.iam.User(`${this.config.get('organizationName')}-pulumi-cicd`, {
            name: `${this.config.get('organizationName')}-pulumi-cicd`
        })

    
    private setCICDUserPolicy = (user: aws.iam.User): aws.iam.UserPolicy =>
        new aws.iam.UserPolicy(`${this.config.get('organizationName')}-pulumi-cicd`, {
            user: user.name,
            policy: aws.iam.getPolicyDocument({
                statements: [
                    {
                        actions: [
                            // Basic permissions
                            "iam:*",
                            "s3:*",
                            "ec2:*",
                            // Key Management Service
                            "kms:*",
                            // Required by EKS provider
                            "eks:*",
                            "ssm:*",
                            "autoscaling:*",
                            "cloudformation:*"
                        ],
                        resources: ["*"],
                    }
                ],
            }).then(_ => _.json)
        })


    private setCICDUserAccessKey = (user: aws.iam.User): aws.iam.AccessKey =>
        new aws.iam.AccessKey(`${this.config.get('organizationName')}-pulumi-cicd`, {
            user: user.name
        })


    private setSecretProviderKey = (keyName: string): aws.kms.Key =>
        new aws.kms.Key(keyName, {
            description: 'Key for Pulumi secret provider',
            tags: {
                Name: keyName
            }
        })
    
    
    private setBackendBucket = (bucketPrefix: string): aws.s3.Bucket =>
        new aws.s3.Bucket(bucketPrefix, {
            bucketPrefix,
            tags: {
                Name: bucketPrefix
            }
        })
}

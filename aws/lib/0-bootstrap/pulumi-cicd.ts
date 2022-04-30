import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { Output } from '@pulumi/pulumi'

export class PulumiCICD {
    public readonly accessKeyId!: Output<string>
    public readonly accessKeySecret!: Output<string>
    public readonly secretProviderKeyId!: Output<string>
    public readonly backendBucketName!: Output<string>


    constructor (private readonly config: pulumi.Config) {
        const cicdUser = this.cicdUser()
        this.cicdUserPolicy(cicdUser)
        const accessKey = this.cicdUserAccessKey(cicdUser)
        this.accessKeyId = accessKey.id
        this.accessKeySecret = accessKey.secret
        this.secretProviderKeyId = this.secretProviderKey(`${this.config.get('organizationName')}/${pulumi.getStack()}/pulumi-secret-provider`).keyId
        this.backendBucketName = this.backendBucket(`${this.config.get('organizationName')}-${pulumi.getStack()}-pulumi-backend`).bucket
    }


    private cicdUser = (): aws.iam.User =>
        new aws.iam.User(`${this.config.get('organizationName')}-pulumi-cicd`, {
            name: `${this.config.get('organizationName')}-pulumi-cicd`
        })

    
    private cicdUserPolicy = (user: aws.iam.User): aws.iam.UserPolicy =>
        new aws.iam.UserPolicy(`${this.config.get('organizationName')}-pulumi-cicd`, {
            user: user.name,
            policy: aws.iam.getPolicyDocument({
                statements: [
                    {
                        actions: [
                            "kms:*",
                            "iam:*",
                            "s3:*"
                        ],
                        resources: ["*"],
                    }
                ],
            }).then(_ => _.json)
        })


    private cicdUserAccessKey = (user: aws.iam.User): aws.iam.AccessKey =>
        new aws.iam.AccessKey(`${this.config.get('organizationName')}-pulumi-cicd`, {
            user: user.name
        })


    private secretProviderKey = (keyName: string): aws.kms.Key =>
        new aws.kms.Key(keyName, {
            description: 'Key for Pulumi secret provider',
            tags: {
                Name: keyName
            }
        })
    
    
    private backendBucket = (bucketPrefix: string): aws.s3.Bucket =>
        new aws.s3.Bucket(bucketPrefix, {
            bucketPrefix,
            tags: {
                Name: bucketPrefix
            }
        })
}

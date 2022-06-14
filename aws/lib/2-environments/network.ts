import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'


export interface SubnetProps {
    availabilityZone: string
    cidrBlock?: string
    mapPublicIpOnLaunch: boolean
}


export class Network {
    public readonly vpc!: aws.ec2.Vpc
    public readonly publicSubnets!: aws.ec2.Subnet[]
    public readonly privateSubnets!: aws.ec2.Subnet[]


    constructor(private readonly config: pulumi.Config, private readonly environment: string) {
        const vpc = this.setVpc()
        const publicSubnets = this.publicSubnetProps().map(_ => this.setSubnet(vpc, 'public', _))
        const privateSubnets = this.privateSubnetProps().map(_ => this.setSubnet(vpc, 'private', _))

        // Configure Internet Gateway for public subnets
        const internetGateway = this.setInternetGateway(vpc)
        const publicRouteTable = this.setPublicRouteTable(vpc, internetGateway)
        this.associatePublicSubnetsToRouteTable(publicRouteTable, publicSubnets)

        // Configure NAT Gateways to allow private subnets to access to internet
        publicSubnets.forEach((publicSub, i) => this.setNatGateway(publicSub, privateSubnets[i], i))

        this.vpc = vpc
        this.publicSubnets = publicSubnets
        this.privateSubnets = privateSubnets
    }


    private setVpc = (): aws.ec2.Vpc =>
        new aws.ec2.Vpc('apps', {
            cidrBlock: this.config.get('vpcCidrBlock'),
            enableDnsHostnames: true,
            tags: { Name: `${this.environment}-apps` }
        })


    private publicSubnetProps = (): SubnetProps[] => [
        {
            availabilityZone: aws.config.requireRegion().toString() + 'a',
            cidrBlock: this.config.get('publicSubnetCidrZoneA'),
            mapPublicIpOnLaunch: true
        },
        {
            availabilityZone: aws.config.requireRegion().toString() + 'b',
            cidrBlock: this.config.get('publicSubnetCidrZoneB'),
            mapPublicIpOnLaunch: true
        },
        {
            availabilityZone: aws.config.requireRegion().toString() + 'c',
            cidrBlock: this.config.get('publicSubnetCidrZoneC'),
            mapPublicIpOnLaunch: true
        }
    ]


    private privateSubnetProps = (): SubnetProps[] => [
        {
            availabilityZone: aws.config.requireRegion().toString() + 'a',
            cidrBlock: this.config.get('privateSubnetCidrZoneA'),
            mapPublicIpOnLaunch: false
        },
        {
            availabilityZone: aws.config.requireRegion().toString() + 'b',
            cidrBlock: this.config.get('privateSubnetCidrZoneB'),
            mapPublicIpOnLaunch: false
        },
        {
            availabilityZone: aws.config.requireRegion().toString() + 'c',
            cidrBlock: this.config.get('privateSubnetCidrZoneC'),
            mapPublicIpOnLaunch: false
        }
    ]


    private setSubnet = (vpc: aws.ec2.Vpc, type: 'public' | 'private', subnetProps: SubnetProps) =>
        new aws.ec2.Subnet(`apps-${type}-${subnetProps.availabilityZone}`, {
            ...subnetProps,
            vpcId: vpc.id,
            tags: { Name: `${this.environment}-apps-${type}-${subnetProps.availabilityZone}` }
        })


    private setInternetGateway = (vpc: aws.ec2.Vpc): aws.ec2.InternetGateway =>
        new aws.ec2.InternetGateway('apps-public', { vpcId: vpc.id })


    private setPublicRouteTable = (vpc: aws.ec2.Vpc, ig: aws.ec2.InternetGateway): aws.ec2.RouteTable =>
        new aws.ec2.RouteTable('apps-public', {
            vpcId: vpc.id,
            routes: [{ cidrBlock: '0.0.0.0/0', gatewayId: ig.id }],
            tags: { Name: `${this.environment}-apps-public` }
        })


    private associatePublicSubnetsToRouteTable = (routeTable: aws.ec2.RouteTable, publicSubnets: aws.ec2.Subnet[]): aws.ec2.RouteTableAssociation[] =>
        publicSubnets.map((subnet, index) => new aws.ec2.RouteTableAssociation(`apps-public-subnet-${index}`, {
            routeTableId: routeTable.id,
            subnetId: subnet.id
        }))


    private setNatGateway(publicSubnet: aws.ec2.Subnet, privateSubnet: aws.ec2.Subnet, index: number): void {
        const ng = new aws.ec2.NatGateway(`apps-${index}`, {
            subnetId: publicSubnet.id,
            connectivityType: 'public',
            allocationId: (new aws.ec2.Eip(`apps-${index}`, { vpc: true })).id
        })
        const routeTable = new aws.ec2.RouteTable(`apps-private-${index}`, {
            vpcId: publicSubnet.vpcId,
            routes: [{ cidrBlock: '0.0.0.0/0', natGatewayId: ng.id }]
        })
        new aws.ec2.RouteTableAssociation(`apps-private-subnet-${index}`, {
            routeTableId: routeTable.id,
            subnetId: privateSubnet.id
        })
    }
}

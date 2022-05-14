import * as aws from '@pulumi/aws'


export interface SubnetProps {
    az: string
    publicSubnetCidr?: string
    privateSubnetCidr?: string
}


export interface EnvNetworkProps {
    vpcName: string
    vpcCidrBlock?: string
    availabilityZones: SubnetProps[]
}

export class Network {
    public readonly vpc!: aws.ec2.Vpc
    public readonly privateSubnets!: aws.ec2.Subnet[]
    public readonly publicSubnets!: aws.ec2.Subnet[]

    constructor (private readonly props: EnvNetworkProps) {
        this.vpc = this.setVpc()
        this.publicSubnets = this.setPublicSubnets()
        this.privateSubnets = this.setPrivateSubnets()
        const routeTable = this.setRouteTable()
        const internetGateway = this.setInternetGateway()
        this.setInternetGatewayRoute(routeTable, internetGateway)
        this.associatePublicSubnetsToRouteTable(routeTable)
    }


    private setVpc = (): aws.ec2.Vpc =>
        new aws.ec2.Vpc(this.props.vpcName, {
            cidrBlock: this.props.vpcCidrBlock,
            enableDnsHostnames: true,
            tags: {
                Name: this.props.vpcName
            }
        })


    private setPublicSubnets = (): aws.ec2.Subnet[] =>
        this.props.availabilityZones
            .map(_ => new aws.ec2.Subnet(`${this.props.vpcName}-public-${_.az}`, {
                vpcId: this.vpc.id,
                availabilityZone: _.az,
                cidrBlock: _.publicSubnetCidr,
                mapPublicIpOnLaunch: true,
                tags: {
                    Name: `${this.props.vpcName}-public-${_.az}`
                }
            }))


    private setPrivateSubnets = (): aws.ec2.Subnet[] =>
        this.props.availabilityZones
            .map(_ => new aws.ec2.Subnet(`${this.props.vpcName}-private-${_.az}`, {
                vpcId: this.vpc.id,
                availabilityZone: _.az,
                cidrBlock: _.privateSubnetCidr,
                tags: {
                    Name: `${this.props.vpcName}-private-${_.az}`
                }
            }))


    private setRouteTable = (): aws.ec2.RouteTable =>
        new aws.ec2.RouteTable(this.props.vpcName, {
            vpcId: this.vpc.id,
            tags: {
                Name: this.props.vpcName
            }
        })

    
    private setInternetGateway = (): aws.ec2.InternetGateway =>
        new aws.ec2.InternetGateway(this.props.vpcName, {
            vpcId: this.vpc.id,
            tags: {
                Name: this.props.vpcName
            }
        })


    private setInternetGatewayRoute = (routeTable: aws.ec2.RouteTable, ig: aws.ec2.InternetGateway): aws.ec2.Route =>
        new aws.ec2.Route(this.props.vpcName, {
            routeTableId: routeTable.id,
            destinationCidrBlock: '0.0.0.0/0',
            gatewayId: ig.id
        })


    private associatePublicSubnetsToRouteTable = (routeTable: aws.ec2.RouteTable): aws.ec2.RouteTableAssociation[] =>
        this.publicSubnets.map((subnet, index) => new aws.ec2.RouteTableAssociation(`${this.props.vpcName}-subnet-${index}`, {
            routeTableId: routeTable.id,
            subnetId: subnet.id
        }))
}

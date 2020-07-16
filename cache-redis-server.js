const { RedisCache } = require('apollo-server-cache-redis');
const { RESTDataSource } = require('apollo-datasource-rest');
const { ApolloServer, gql } = require('apollo-server');
const responseCachePlugin = require('apollo-server-plugin-response-cache');

class RocketAPI extends RESTDataSource {
    constructor() {
      super();
      this.baseURL = 'https://api.spacexdata.com/v2/';
    }
  
    async getAllLaunches() {
        const response = await this.get('launches');
        
        return Array.isArray(response)
          ? response.map(launch => ({
              id: launch.flight_number || 999,
              missionName: launch.mission_name,
              rocketName: launch.rocket.rocket_name
          })) : [];
    }
}

const typeDefs = gql`
type Launch {
    id: ID!
    missionName: String
    rocketName: String
}

type Query {
    launches: [Launch]
}
`;

const resolvers = {
    Query: {
        launches: async(root, args, context, info) => {
            info.cacheControl.setCacheHint({ maxAge: 60 });
            return context.dataSources.rocketAPI.getAllLaunches();
        },
    }
} 

const server = new ApolloServer({
    typeDefs,
    resolvers,
    cache: new RedisCache({
      host: 'localhost', // 'redis-server',
      // Options are passed through to the Redis client
    }),
    dataSources: () => ({
      rocketAPI: new RocketAPI(),
    }),
    plugins: [responseCachePlugin()],
});

server.listen(8001).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});
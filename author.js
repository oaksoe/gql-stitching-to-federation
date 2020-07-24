const { ApolloServer, gql } = require('apollo-server');
const { buildFederatedSchema } = require('@apollo/federation');
// const { RedisCache } = require('apollo-server-cache-redis');
const { AerospikeCache } = require('apollo-server-cache-aerospike-kv');
const responseCachePlugin = require('apollo-server-plugin-response-cache');

// Federation way
// const authorSchema = {
//     typeDefs: gql`
//     directive @cacheControl(
//         maxAge: Int,
//         scope: CacheControlScope
//     ) on OBJECT | FIELD_DEFINITION
    
//     enum CacheControlScope {
//         PUBLIC
//         PRIVATE
//     }

//         type User @key(fields: "id") {
//             id: ID!
//             email: String @cacheControl(maxAge: 100)
//         }
    
//         type Query {
//             userById(id: ID!): User @cacheControl(maxAge: 200)
//         }

//         extend type Chirp @key(fields: "id") {
//             id: ID! @external
//             authorId: ID! @external
//             author: User @requires(fields: "authorId")
//         }
//     `,
//     resolvers: {
//         Chirp: {
//             author: ({ authorId, ...args }) => {
//                 return {id: 1, email: 'oakoak@gmail.com'};
//             },
//         },
//         Query: {
//             userById: (root, args, context, info) => {
//                 // info.cacheControl.setCacheHint({ maxAge: 222 });
//                 return {id: 1, email: 'oak@gmail.com'};
//             },
//         }
//     } 
// };

// const server = new ApolloServer({ 
//     schema: buildFederatedSchema(authorSchema)
// });

// Non-federation way
const authorSchema = {
    typeDefs: gql`
        type User @cacheControl(maxAge: 1000) {
            id: ID!
            email: String @cacheControl(maxAge: 1500)
        }
    
        type Query {
            userById(id: ID!): User
        }
    `,
    resolvers: {
        Query: {
            userById: (root, args, context, info) => {
                info.cacheControl.setCacheHint({ maxAge: 6000 });
                return {id: 1, email: 'oak@gmail.com'};
            },
        }
    } 
};

const server = new ApolloServer({
    ...authorSchema,
    // cache: new RedisCache({
    //     host: 'localhost', // 'redis-server',
    //     // Options are passed through to the Redis client
    // }),
    cache: new AerospikeCache({
        hosts: '172.28.128.3:3000',  // to get ip address of aerospike => vagrant ssh -c "ip addr"|grep 'global eth1'
      }, {
        namespace: 'test',
        set: 'cache',
    }),
    plugins: [responseCachePlugin()],
    //introspection: false,
});

server.listen(4002).then(({ url }) => {
console.log(`🚀 Server ready at ${url}`)
});
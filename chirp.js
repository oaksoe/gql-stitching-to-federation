const { ApolloServer, gql } = require('apollo-server');
const { buildFederatedSchema } = require('@apollo/federation');

// Federation way
const chirpSchema = {
    typeDefs: gql`
    directive @cacheControl(
        maxAge: Int,
        scope: CacheControlScope
    ) on OBJECT | FIELD_DEFINITION
    
    enum CacheControlScope {
        PUBLIC
        PRIVATE
    }
    
        type Chirp @key(fields: "id") {
            id: ID!
            text: String @cacheControl(maxAge: 777)
            authorId: ID!
        }

        type Query {
            chirpById(id: ID!): Chirp @cacheControl(maxAge: 888)
            chirpsByAuthorId(authorId: ID!): [Chirp] @cacheControl(maxAge: 999)
        }

        extend type User @key(fields: "id") {
            id: ID! @external
            chirps: [Chirp] @requires(fields: "id")
        }
    `,
    resolvers: {
        User: {
            chirps: (id) => {
                return [{id: 1, text: 'chirp by author oak', authorId: 1}];
            },
        },
        Query: {
            chirpById: (root, args, context, info) => ({id: 1, text: 'first chirp', authorId: 1}),
            chirpsByAuthorId: (root, args, context, info) => [{id: 1, text: 'first chirp', authorId: 1}],
        }
    } 
};

const server = new ApolloServer({ 
    schema: buildFederatedSchema([chirpSchema])
});

// Non-federation way
// const chirpSchema = {
//     typeDefs: gql`
//         type Chirp {
//             id: ID!
//             text: String
//             authorId: ID!
//         }

//         type Query {
//             chirpById(id: ID!): Chirp
//             chirpsByAuthorId(authorId: ID!): [Chirp]
//         }
//     `,
//     resolvers: {
//         Query: {
//             chirpById: (root, args, context, info) => {
//                 info.cacheControl.setCacheHint({ maxAge: 888 });
//                 return {id: 1, text: 'first chirp', authorId: 1}
//             },
//             chirpsByAuthorId: (root, args, context, info) => {
//                 info.cacheControl.setCacheHint({ maxAge: 777 });
//                 return [{id: 1, text: 'first chirp', authorId: 1}]
//             },
//         }
//     } 
// };

// const server = new ApolloServer(chirpSchema);

server.listen(4001).then(({ url }) => {
console.log(`🚀 Server ready at ${url}`)
});

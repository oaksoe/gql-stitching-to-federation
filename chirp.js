const { ApolloServer, gql } = require('apollo-server');
// const { buildFederatedSchema } = require('@apollo/federation');

// Federation way
// const chirpSchema = {
//     typeDefs: gql`
//         type Chirp @key(fields: "id") {
//             id: ID!
//             text: String
//             authorId: ID!
//         }

//         type Query {
//             chirpById(id: ID!): Chirp
//             chirpsByAuthorId(authorId: ID!): [Chirp]
//         }

//         extend type User @key(fields: "id") {
//             id: ID! @external
//             chirps: [Chirp] @requires(fields: "id")
//         }
//     `,
//     resolvers: {
//         User: {
//             chirps: (id) => {
//                 return [{id: 1, text: 'chirp by author oak', authorId: 1}];
//             },
//         },
//         Query: {
//             chirpById: (root, args, context, info) => ({id: 1, text: 'first chirp', authorId: 1}),
//             chirpsByAuthorId: (root, args, context, info) => [{id: 1, text: 'first chirp', authorId: 1}],
//         }
//     } 
// };

// const server = new ApolloServer({ 
//     schema: buildFederatedSchema([chirpSchema])
// });

// Non-federation way
const chirpSchema = {
    typeDefs: gql`
        type Chirp @cacheControl(maxAge: 200) {
            id: ID!
            text: String @cacheControl(maxAge: 100)
            authorId: ID!
        }

        type Query {
            chirpById(id: ID!): Chirp
            chirpsByAuthorId(authorId: ID!): [Chirp] @cacheControl(maxAge: 600)
        }
    `,
    resolvers: {
        Query: {
            chirpById: (root, args, context, info) => ({id: 1, text: 'first chirp', authorId: 1}),
            chirpsByAuthorId: (root, args, context, info) => [{id: 1, text: 'first chirp', authorId: 1}],
        }
    } 
};

const server = new ApolloServer(chirpSchema);

server.listen(4001).then(({ url }) => {
console.log(`🚀 Server ready at ${url}`)
});

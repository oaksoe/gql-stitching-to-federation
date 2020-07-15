const { ApolloServer, gql } = require('apollo-server');
const { buildFederatedSchema } = require('@apollo/federation');

// Federation way
const authorSchema = {
    typeDefs: gql`
    directive @cacheControl(
        maxAge: Int,
        scope: CacheControlScope
    ) on OBJECT | FIELD_DEFINITION
    
    enum CacheControlScope {
        PUBLIC
        PRIVATE
    }

        type User @key(fields: "id") {
            id: ID!
            email: String @cacheControl(maxAge: 150)
        }
    
        type Query {
            userById(id: ID!): User @cacheControl(maxAge: 300) 
        }

        extend type Chirp @key(fields: "id") {
            id: ID! @external
            authorId: ID! @external
            author: User @requires(fields: "authorId")
        }
    `,
    resolvers: {
        Chirp: {
            author: ({ authorId }) => {
                return {id: 1, email: 'oakoak@gmail.com'};
            },
        },
        Query: {
            userById: (root, args, context, info) => ({id: 1, email: 'oak@gmail.com'}),
        }
    } 
};

const server = new ApolloServer({ 
    schema: buildFederatedSchema(authorSchema)
});

// Non-federation way
// const authorSchema = {
//     typeDefs: gql`
//         type User {
//             id: ID!
//             email: String
//         }
    
//         type Query {
//             userById(id: ID!): User
//         }
//     `,
//     resolvers: {
//         Query: {
//             userById: (root, args, context, info) => {
//                 info.cacheControl.setCacheHint({ maxAge: 999 });
//                 return {id: 1, email: 'oak@gmail.com'};
//             },
//         }
//     } 
// };

// const server = new ApolloServer(authorSchema);

server.listen(4002).then(({ url }) => {
console.log(`🚀 Server ready at ${url}`)
});
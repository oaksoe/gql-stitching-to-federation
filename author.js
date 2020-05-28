const { ApolloServer, gql } = require('apollo-server');
const { buildFederatedSchema } = require('@apollo/federation');
  
const authorSchema = {
    typeDefs: gql`
        type User @key(fields: "id") {
            id: ID!
            email: String
        }
    
        type Query {
            userById(id: ID!): User
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

server.listen(4002).then(({ url }) => {
console.log(`🚀 Server ready at ${url}`)
});
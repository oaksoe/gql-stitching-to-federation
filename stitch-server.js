// https://www.apollographql.com/docs/apollo-server/features/schema-stitching/

/*
const express = require('express')
const app = express()
 
app.get('/', function (req, res) {
  res.send('Hello World')
})
 
app.listen(3000);
*/

const { ApolloServer } = require('apollo-server');
const { introspectSchema, makeRemoteExecutableSchema, mergeSchemas } = require('graphql-tools');
const { HttpLink } = require('apollo-link-http');
const fetch = require('node-fetch');

const fetchFromRemoteSchema = async(remoteUrl) => {
    const link = new HttpLink({ uri: remoteUrl, fetch });
    const schema = await introspectSchema(link);

    const executableSchema = makeRemoteExecutableSchema({
        schema,
        link,
    });

    return executableSchema;
}
  
const fetchChirpSchema = fetchFromRemoteSchema('http://localhost:4001/graphql');
const fetchAuthorSchema = fetchFromRemoteSchema('http://localhost:4002/graphql');

const linkTypeDefs = `
  extend type User {
    chirps: [Chirp]
  }

  extend type Chirp {
    author: User
  }
`;

const makeResolversForSchemaStiching = (chirpSchema, authorSchema) => ({
    User: {
        chirps: {
            fragment: `fragment UserFragment on User { id }`,
            resolve(user, args, context, info) {
                return info.mergeInfo.delegateToSchema({
                    schema: chirpSchema,
                    operation: 'query',
                    fieldName: 'chirpsByAuthorId',
                    args: {
                        authorId: user.id,
                    },
                    context,
                    info,
                });
            },
        },
    },
    Chirp: {
        author: {
            fragment: `fragment ChirpFragment on Chirp { authorId }`,
            resolve(chirp, args, context, info) {
                return info.mergeInfo.delegateToSchema({
                    schema: authorSchema,
                    operation: 'query',
                    fieldName: 'userById',
                    args: {
                        id: chirp.authorId,
                    },
                    context,
                    info,
                });
            },
        },
    },
});

Promise.all([fetchChirpSchema, fetchAuthorSchema]).then(([chirpSchema, authorSchema]) => {

    const schema = mergeSchemas({
        schemas: [chirpSchema, authorSchema, linkTypeDefs],
        resolvers: makeResolversForSchemaStiching(chirpSchema, authorSchema),
    });
    
    const server = new ApolloServer({ schema });
    
    server.listen(4000).then(({ url }) => {
        console.log(`🚀 Server ready at ${url}`)
    });
});

/* Sample queries
{
  chirpById(id:1) {
    id
    text
    authorId
    author {
      id
      email
      chirps {
        id
        text
      }
    }
  }
}

{
  userById(id:1) {
    id
    email
    chirps {
      id
      text
      authorId
      author {
        id
        email
      }
    }
  }
}
*/

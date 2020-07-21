// https://www.apollographql.com/docs/apollo-server/features/schema-stitching/

/*
const express = require('express')
const app = express()
 
app.get('/', function (req, res) {
  res.send('Hello World')
})
 
app.listen(3000);
*/

const { ApolloLink } = require('apollo-link');
const { ApolloServer } = require('apollo-server');
const { introspectSchema, makeRemoteExecutableSchema, mergeSchemas } = require('graphql-tools');
const { HttpLink } = require('apollo-link-http');
const fetch = require('node-fetch');

const CacheHeaderRegex = /^max-age=([0-9]+), public$/;

const calculateCacheHeader = (cacheControl = []) => {
  const maxAge = cacheControl.map((h) => CacheHeaderRegex.exec(h))
        .map((matches) => matches || [])
        .map((matches) => matches[1] || 0) // eslint-disable-line no-magic-numbers
        .reduce((acc, val) => Math.min(acc, val), +Infinity);

    return maxAge ? `max-age=${maxAge}, public` : 'no-cache';
};

const CacheControlHeaderPlugin = {
    requestDidStart () {
        return {
            willSendResponse ({ response, context }) {
                if (context.cacheControl) {
                  console.log(context.cacheControl);
                  const cacheHeader = calculateCacheHeader(context.cacheControl);
                  response.http.headers.set('Cache-Control', cacheHeader);
                }
            }
        };
    }
};

const fetchFromRemoteSchema = async(remoteUrl) => {
    const retrieveCacheHintLink = new ApolloLink((operation, forward) => {
      return forward(operation).map(response => {
        const context = operation.getContext();

        if (context.graphqlContext) {
          const cacheControl = context.response.headers.get('Cache-Control');
    
          if (cacheControl) {
            if (!context.graphqlContext.cacheControl || !Array.isArray(context.graphqlContext.cacheControl)) {
              context.graphqlContext.cacheControl = [];
            }
      
            context.graphqlContext.cacheControl.push(cacheControl);
          }
        }

        return response;
      })
    });

    const link = ApolloLink.from([retrieveCacheHintLink, new HttpLink({ uri: remoteUrl, fetch })]);
    //const link = new HttpLink({ uri: remoteUrl, fetch });
    const schema = await introspectSchema(link);

    const executableSchema = makeRemoteExecutableSchema({
        schema,
        link
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
    
    const server = new ApolloServer({ 
      schema,
      plugins: [
        CacheControlHeaderPlugin
      ], 
    });
    
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

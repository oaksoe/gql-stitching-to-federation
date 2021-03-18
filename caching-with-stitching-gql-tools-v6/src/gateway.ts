import { ApolloServer } from 'apollo-server';
import { stitchSchemas } from '@graphql-tools/stitch';
import { delegateToSchema } from '@graphql-tools/delegate';
import fetchRemoteSchema from './utils/remoteSchema';
import { CacheControlHeaderPlugin } from './utils/cacheControlHeaderPlugin';

const authorUrl = 'http://localhost:1234/graphql';
const chirpUrl = 'http://localhost:4321/graphql';

const fetchAuthorSchema = fetchRemoteSchema(authorUrl);
const fetchChirpSchema = fetchRemoteSchema(chirpUrl);

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
              return delegateToSchema({
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
              return delegateToSchema({
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

Promise.all([fetchAuthorSchema, fetchChirpSchema]).then(([authorSchema, chirpSchema]) => {
  const gatewaySchema = stitchSchemas({
    subschemas: [authorSchema, chirpSchema],
    typeDefs: linkTypeDefs,
    resolvers: makeResolversForSchemaStiching(chirpSchema, authorSchema)
    // subschemas: [
    //   {
    //     ...authorSchema,
    //     merge: {
    //       User: {
    //         fieldName: 'userById',
    //         selectionSet: '{ id }',
    //         args: partialUser => ({ id: partialUser.id }),
    //       },
    //     },
    //   },
    //   {
    //     ...chirpSchema,
    //     merge: {
    //       User: {
    //         fieldName: 'userById',
    //         selectionSet: '{ id }',
    //         args: partialUser => ({ id: partialUser.id }),
    //       },
    //     },
    //   },
    // ],
    // mergeTypes: true,
  });

  const server = new ApolloServer({
    schema: gatewaySchema,
    plugins: [CacheControlHeaderPlugin],
  });

  server.listen(4000).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
});

// const {
//     ApolloServerPlugin,
//     GraphQLRequestListener,
//   } = require('apollo-server-plugin-base');
// const { GraphQLRequestContext, GraphQLResponse, ValueOrPromise } = require('apollo-server-types');
const { PrefixingKeyValueCache } = require('apollo-server-caching');
const { CacheScope } = require('apollo-cache-control');
  
  // XXX This should use createSHA from apollo-server-core in order to work on
  // non-Node environments. I'm not sure where that should end up ---
  // apollo-server-sha as its own tiny module? apollo-server-env seems bad because
  // that would add sha.js to unnecessary places, I think?
const { createHash } = require('crypto');
  
function sha(s) {
  return createHash('sha256')
    .update(s)
    .digest('hex');
}

function cacheKeyString(key) {
  return sha(JSON.stringify(key));
}

function isGraphQLQuery(requestContext) {
  return (
    requestContext.operation && requestContext.operation.operation === 'query'
  );
}

function isGraphQLMutation(requestContext) {
  return (
    requestContext.operation && requestContext.operation.operation === 'mutation'
  );
}

async function cacheGet(
  requestContext,
  cache,
  baseCacheKey,
  contextualCacheKeyFields,
) {
  const key = cacheKeyString({
    ...baseCacheKey,
    ...contextualCacheKeyFields,
  });
  const serializedValue = await cache.get(key);
  if (serializedValue === undefined) {
    return null;
  }

  const value= JSON.parse(serializedValue);
  // Use cache policy from the cache (eg, to calculate HTTP response
  // headers).
  requestContext.overallCachePolicy = value.cachePolicy;
  requestContext.metrics.responseCacheHit = true;
  age = Math.round((+new Date() - value.cacheTime) / 1000);
  return { data: value.data };
}

function cacheSetInBackground(
  data,
  logger,
  cache,
  baseCacheKey,
  overallCachePolicy,
  contextualCacheKeyFields,
) {
  const key = cacheKeyString({
    ...baseCacheKey,
    ...contextualCacheKeyFields,
  });
  const value= {
    data,
    cachePolicy: overallCachePolicy,
    cacheTime: +new Date(),
  };
  const serializedValue = JSON.stringify(value);
  // Note that this function converts key and response to strings before
  // doing anything asynchronous, so it can run in parallel with user code
  // without worrying about anything being mutated out from under it.
  //
  // Also note that the test suite assumes that this asynchronous function
  // still calls `cache.set` synchronously (ie, that it writes to
  // InMemoryLRUCache synchronously).
  cache
    .set(key, serializedValue, { ttl: overallCachePolicy.maxAge })
    .catch(logger.warn);
}

function cacheSetMutatedIds() {
  
}

const cachedTypes = [
  'user',
];

const CustomResponseCachePlugin = {
    requestDidStart(
        outerRequestContext,
      ) {
        const options = {};
        const cache = new PrefixingKeyValueCache(
          options.cache || outerRequestContext.cache,
          'fqc:',
        );
  
        let sessionId = null;
        let baseCacheKey = null;
        let age = null;
  
        return {
          async responseForOperation(
            requestContext,
          ) {
            requestContext.metrics.responseCacheHit = false;

            if (!isGraphQLQuery(requestContext)) {
              return null;
            }
  
            // Call hooks. Save values which will be used in willSendResponse as well.
            let extraCacheKeyData = null;
            if (options.sessionId) {
              sessionId = await options.sessionId(requestContext);
            }
            if (options.extraCacheKeyData) {
              extraCacheKeyData = await options.extraCacheKeyData(requestContext);
            }
  
            baseCacheKey = {
              source: requestContext.source,
              operationName: requestContext.operationName,
              // Defensive copy just in case it somehow gets mutated.
              variables: { ...(requestContext.request.variables || {}) },
              extra: extraCacheKeyData,
            };
  
            // Note that we set up sessionId and baseCacheKey before doing this
            // check, so that we can still write the result to the cache even if
            // we are told not to read from the cache.
            if (
              options.shouldReadFromCache &&
              !options.shouldReadFromCache(requestContext)
            ) {
              return null;
            }

            if (sessionId === null) {
              return cacheGet(
                requestContext,
                cache,
                baseCacheKey,
                { sessionMode: 0 });
            } else {
              const privateResponse = await cacheGet(
                requestContext,
                cache,
                baseCacheKey,
                {
                  sessionId,
                  sessionMode: 1,
                });
              if (privateResponse !== null) {
                return privateResponse;
              }
              return cacheGet(
                requestContext,
                cache,
                baseCacheKey,
                { sessionMode: 2 });
            }
          },
  
          async willSendResponse(requestContext) {
            const logger = requestContext.logger || console;
  
            if (isGraphQLMutation(requestContext)) {
              let mutationString = requestContext.source;
              mutationString = mutationString.replace(/\s+/g, '');
              mutationString = mutationString.split('{')[1];
              
              cachedTypes.forEach(cachedType => {
                if (mutationString.toLowerCase().includes(cachedType)) {
                  const match = mutationString.match(/id:[\d]+/g)[0];
                  console.log('ajsldfa;sfjafas ', match);
                }
              });

              
              return;
            }

            if (!isGraphQLQuery(requestContext)) {
              return;
            }

            if (requestContext.metrics.responseCacheHit) {
              // Never write back to the cache what we just read from it. But do set the Age header!
              const http = requestContext.response.http;
              if (http && age !== null) {
                http.headers.set('age', age.toString());
              }
              return;
            }

            if (
              options.shouldWriteToCache &&
              !options.shouldWriteToCache(requestContext)
            ) {
              return;
            }
  
            const { response, overallCachePolicy } = requestContext;
            if (
              response.errors ||
              !response.data ||
              !overallCachePolicy ||
              overallCachePolicy.maxAge <= 0
            ) {
              // This plugin never caches errors or anything without a cache policy.
              //
              // There are two reasons we don't cache errors. The user-level
              // reason is that we think that in general errors are less cacheable
              // than real results, since they might indicate something transient
              // like a failure to talk to a backend. (If you need errors to be
              // cacheable, represent the erroneous condition explicitly in data
              // instead of out-of-band as an error.) The implementation reason is
              // that this lets us avoid complexities around serialization and
              // deserialization of GraphQL errors, and the distinction between
              // formatted and unformatted errors, etc.
              return;
            }
  
            const data = response.data;
  
            // We're pretty sure that any path that calls willSendResponse with a
            // non-error response will have already called our execute hook above,
            // but let's just double-check that, since accidentally ignoring
            // sessionId could be a big security hole.
            if (!baseCacheKey) {
              throw new Error(
                'willSendResponse called without error, but execute not called?',
              );
            }
  
            const isPrivate = overallCachePolicy.scope === CacheScope.Private;
            if (isPrivate) {
              if (!options.sessionId) {
                logger.warn(
                  'A GraphQL response used @cacheControl or setCacheHint to set cache hints with scope ' +
                    "Private, but you didn't define the sessionId hook for " +
                    'apollo-server-plugin-response-cache. Not caching.',
                );
                return;
              }
              if (sessionId === null) {
                // Private data shouldn't be cached for logged-out users.
                return;
              }
              cacheSetInBackground(
                data,
                logger,
                cache,
                baseCacheKey,
                overallCachePolicy,
                {
                  sessionId,
                  sessionMode: 1,
                });
            } else {
              cacheSetInBackground(
                data,
                logger,
                cache,
                baseCacheKey,
                overallCachePolicy,
                {
                  sessionMode:
                    sessionId === null
                      ? 0
                      : 2,
                });
            }
          },
        };
      },
};

module.exports = {
    CustomResponseCachePlugin,
}
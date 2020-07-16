const { ApolloGateway, RemoteGraphQLDataSource } = require('@apollo/gateway');
const { ApolloServer } = require('apollo-server');
const responseCachePlugin = require('apollo-server-plugin-response-cache');

class CachedDataSource extends RemoteGraphQLDataSource {
    async didReceiveResponse ({ response, request , context }) {
        const cacheControl = response.http.headers.get('Cache-Control');
    
        if (!context.cacheControl || !Array.isArray(context.cacheControl)) {
            context.cacheControl = [];
        }
    
        context.cacheControl.push(cacheControl);
    
        return response;
    }
}

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
                const cacheHeader = calculateCacheHeader(context.cacheControl);
                response.http.headers.set('Cache-Control', cacheHeader);
            }
        };
    }
};
  
const gateway = new ApolloGateway({
    serviceList: [
      { name: 'chirp', url: 'http://localhost:4001' },
      { name: 'author', url: 'http://localhost:4002' },
    ],
    buildService({ url }) {
        return new CachedDataSource({ url });
      }
});
  
const server = new ApolloServer({ 
    gateway,
    subscriptions: false,
    cacheControl: true, // {calculateHttpHeaders: true},
    // cacheControl: {
    //     defaultMaxAge: 50,
    // },
    tracing: true,
    // plugins: [responseCachePlugin()],
    plugins: [
        CacheControlHeaderPlugin
      ],
});

server.listen(8000).then(({ url }) => {
    console.log("Gateway listening at " + url);
})


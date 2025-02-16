const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { promisify } = require('util');
const NodeCache = require('node-cache');
const nameToImdb = require('name-to-imdb');
const getImdbIdAsync = promisify(nameToImdb);
const he = require('he');
// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
const cache = new NodeCache({ stdTTL: 604800, checkperiod: 1800, useClones: false });
const filters = [ "Must Watch", "Good", "Satisfactory", "Passable", "Poor", "Skip" ];
const recommendationMapping = { "A": "Must Watch", "B": "Good", "H": "Satisfactory", "C": "Passable", "D": "Poor", "F": "Skip" };
const supportedLanguages = [
    "Hindi", "English", "Telugu", "Tamil", "Malayalam", "Kannada", "Abkhazian", "Afar", "Afrikaans", "Akan", "Albanian", "Amharic", "Arabic", "Aragonese", "Armenian", "Assamese", "Avaric", "Avestan", "Aymara", "Azerbaijani", "Bambara", "Bashkir", "Basque", "Belarusian", "Bengali", "Bhojpuri", "Bislama", "Bosnian", "Breton", "Bulgarian", "Burmese", "Cantonese", "Catalan", "Chamorro", "Chechen", "Chichewa", "Chuvash", "Cornish", "Corsican", "Cree", "Croatian", "Czech", "Danish", "Divehi", "Dutch", "Dzongkha", "Esperanto", "Estonian", "Ewe", "Faroese", "Fijian", "Finnish", "French", "Frisian", "Fulah", "Gaelic", "Galician", "Ganda", "Georgian", "German", "Greek", "Guarani", "Gujarati", "Haitian", "Haryanvi", "Hausa", "Hebrew", "Herero", "Hiri Motu", "Hungarian", "Icelandic", "Ido", "Igbo", "Indonesian", "Interlingua", "Interlingue", "Inuktitut", "Inupiaq", "Irish", "Italian", "Japanese", "Javanese", "Kalaallisut", "Kanuri", "Kashmiri", "Kazakh", "Khmer", "Kikuyu", "Kinyarwanda", "Kirghiz", "Komi", "Kongo", "Korean", "Kuanyama", "Kurdish", "Lao", "Latin", "Latvian", "Letzeburgesch", "Limburgish", "Lingala", "Lithuanian", "Luba-Katanga", "Macedonian", "Malagasy", "Malay", "Maltese", "Mandarin", "Manipuri", "Manx", "Maori", "Marathi", "Marshall", "Moldavian", "Mongolian", "Nauru", "Navajo", "Ndebele", "Ndonga", "Nepali", "Northern Sami", "Norwegian", "Norwegian Bokmål", "Norwegian Nynorsk", "Occitan", "Ojibwa", "Oriya", "Oromo", "Ossetian", "Other", "Pali", "Persian", "Polish", "Portuguese", "Punjabi", "Pushto", "Quechua", "Raeto-Romance", "Romanian", "Rundi", "Russian", "Samoan", "Sango", "Sanskrit", "Sardinian", "Serbian", "Serbo-Croatian", "Shona", "Sindhi", "Sinhalese", "Slavic", "Slovak", "Slovenian", "Somali", "Sotho", "Spanish", "Sundanese", "Swahili", "Swati", "Swedish", "Tagalog", "Tahitian", "Tajik", "Tatar", "Thai", "Tibetan", "Tigrinya", "Tonga", "Tsonga", "Tswana", "Turkish", "Turkmen", "Twi", "Uighur", "Ukrainian", "Urdu", "Uzbek", "Venda", "Vietnamese", "Volapük", "Walloon", "Welsh", "Wolof", "Xhosa", "Yi", "Yiddish", "Yoruba", "Zhuang", "Zulu"
];
// Render Refresh Start
const renderUrl = 'https://binged-stremio.onrender.com';
const interval = 10 * 60 * 1000; // 10 minutes in milliseconds
const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Karachi', timeZoneName: 'long' };

setInterval(() => {
  const date = new Date();
  fetch(renderUrl)
    .then(res => console.info(`Reloaded at ${date.toLocaleString('en-US', options)}: Status ${res.ok ? res.status : 'Error'}`))
    .catch(err => console.error(`Error at ${date.toLocaleString('en-US', options)}: (${err.message})`));
}, interval);
// Render Refresh End

const builder = new addonBuilder({
    id: 'com.binged.latest',
    version: '2.0.0',
    name: 'Binged! OTT Releases Catalog',
    description: 'Provides the latest OTT movies and TV shows catalog available to stream on streaming platforms from Binged.com by Asaddon',
    "behaviorHints": {
        "configurable": true,
        "configurationRequired": false
      },
      config: [
        {
            key: 'rpdbApiKey',
            title: 'RPDB API Key',
            type: 'text',
            required: false
        }
    ],
    catalogs: [
        { "type": "movie", "id": "binged-latest", "name": "Binged - Latest", "extra": [{ "name": "genre", "isRequired": false, "options": supportedLanguages }, { "name": "skip", "isRequired": false }, { "name": "recommendation", "isRequired": false, "options": filters }]},
        { "type": "series", "id": "binged-latest", "name": "Binged - Latest", "extra": [{ "name": "genre", "isRequired": false, "options": supportedLanguages }, { "name": "skip", "isRequired": false }, { "name": "recommendation", "isRequired": false, "options": filters }]}
    ],
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['binged']
});

// Initial fetch function
async function prefetchData() {
    console.log("Starting Initial Global Data Fetch...");
    try {
        await Promise.all([
            fetchAndCacheGlobalData("movie", true), // Fetch all 500 items for movies
            fetchAndCacheGlobalData("series", true) // Fetch all 500 items for series
        ]);
        console.log("Initial Global Data Fetch Completed.");
    } catch (error) {
        console.error("Error During Initial Global Data Fetch:", error.message);
    }
}

// Function to refresh data (fetch only the latest 50 items)
async function refreshCatalogData() {
    //console.log("Refreshing Global Catalog Data...");
    try {
        await Promise.all([
            fetchAndCacheGlobalData("movie"), // Fetch latest 50 items for movies
            fetchAndCacheGlobalData("series") // Fetch latest 50 items for series
        ]);
        //console.log("Global Catalog Data Refreshed.");
    } catch (error) {
        console.error("Error Refreshing Global Catalog Data:", error.message);
    } finally {
        // Schedule the next refresh after 1 hour
        setTimeout(refreshCatalogData, 60 * 60 * 1000); // 1 hour = 60 minutes * 60 seconds * 1000 milliseconds
    }
}

// Initial fetch (fetch all 500 items)
prefetchData().then(() => {
    // Start the refresh loop after the first fetch completes
    setTimeout(refreshCatalogData, 60 * 60 * 1000); // First refresh after 1 hour
});
// Function to fetch data with pagination support
async function fetchBingedData(type, start = 0, length = 50) {
    const url = 'https://www.binged.com/wp-admin/admin-ajax.php';
    const body = new URLSearchParams({
        'filters[category][]': type === 'movie' ? 'Film' : type === 'series' ? 'TV show' : [],
        'filters[mode]': 'streaming-now',
        'filters[page]': 0,
        action: 'mi_events_load_data',
        mode: 'streaming-now',
        start: start,
        length: length,
        customcatalog: 0
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'accept': '*/*',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest',
            'referer': 'https://www.binged.com/streaming-premiere-dates/'
        },
        body: body
    });

    if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
    //const date = new Date();
    //const dateInKarachi = date.toLocaleString('en-US', options);
    //console.log("API response date (Asia/Karachi):", dateInKarachi);
    return response.json();
}

// Convert title to IMDb ID
async function getImdbId(title, year) {
    if (!title?.trim()) return null;
    try {
        const cleanedTitle = title.replace(/\s?\(.*?\)$/, '').replace(/#/g, '').trim();
        return await getImdbIdAsync({ name: cleanedTitle, year }).catch((err) => {
            console.error(`Error Fetching IMDb ID For "${cleanedTitle}" (${year}):`, err.message);
            return null;
        });
    } catch (err) {
        console.error(`Unexpected Error Fetching IMDb ID For "${title}" (${year}):`, err.message);
        return null;
    }
}

// Fetch metadata from Cinemeta
async function getMetadata(imdbId, type) {
    if (!imdbId?.startsWith('tt')) return null;
    try {
        const response = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
        return response.ok ? (await response.json()).meta : null;
    } catch {
        return null;
    }
}

// Check if an image URL is valid
async function isUrlAvailable(url) {
    try {
        return (await fetch(url, { method: 'HEAD' })).ok;
    } catch {
        return false;
    }
}

// Decode special characters in titles
function decodeTitle(title) {
    return he.decode(title);
}

// Function to fetch and cache global data
async function fetchAndCacheGlobalData(type, isInitialFetch = false, initialFetchLimit = 500, refreshFetchLimit = 50) {
    const cacheKey = `global-${type}`;

    try {
        // Fetch data based on the fetch type
        const fetchLimit = isInitialFetch ? initialFetchLimit : refreshFetchLimit;
        console.log(`Fetching ${isInitialFetch ? 'All' : 'Latest'} Data For ${cacheKey}...`);
        const rawData = await fetchBingedData(type, 0, fetchLimit);
        const newMetas = await processRawData(rawData.data, type);

        if (isInitialFetch) {
            // Cache the initial data
            await cache.set(cacheKey, newMetas, 604800); // 7 days
            console.log(`Cached ${newMetas.length} Items For ${cacheKey} With A TTL of 7 Days.`);
            return newMetas;
        }

        // Merge new data with existing data
        const existingData = (await cache.get(cacheKey)) || [];
        const nameToItemMap = new Map();

        // Helper function to check if an ID starts with "tt"
        const isTTId = (id) => id?.startsWith("tt");

        // Add existing items to the Map
        existingData.forEach((item) => {
            const lowerCaseName = item.name.toLowerCase();
            if (!nameToItemMap.has(lowerCaseName) || (isTTId(item.id) && !isTTId(nameToItemMap.get(lowerCaseName)?.id))) {
                nameToItemMap.set(lowerCaseName, item);
            }
        });

        // Add new items to the Map, prioritizing "tt" IDs
        const newItems = [];
        newMetas.forEach((newItem) => {
            const lowerCaseName = newItem.name.toLowerCase();
            if (!nameToItemMap.has(lowerCaseName)) {
                newItems.push(newItem); // Add new items to a separate array
                nameToItemMap.set(lowerCaseName, newItem);
            } else if (isTTId(newItem.id)) {
                const existingItem = nameToItemMap.get(lowerCaseName);
                if (!isTTId(existingItem.id)) {
                    console.log(`Prioritizing item with tt ID: ${newItem.id} over ${existingItem.id}`);
                    nameToItemMap.set(lowerCaseName, newItem);
                }
            }
        });

        // Combine new items (at the top) with existing items
        const updatedData = [...newItems, ...Array.from(nameToItemMap.values()).filter(item => !newItems.includes(item))];

        // Update the cache if there are changes
        if (JSON.stringify(updatedData) !== JSON.stringify(existingData)) {
            console.log(`Updating ${cacheKey} with ${newItems.length} new items at the top.`);
            await cache.set(cacheKey, updatedData, 604800); // 7 days
        } else {
            console.log(`No New Items Found For ${cacheKey}`);
        }

        return updatedData;
    } catch (error) {
        console.error(`Error in fetchAndCacheGlobalData for ${cacheKey}:`, error);
        // Optionally return stale data from cache if available
        const staleData = await cache.get(cacheKey);
        if (staleData) {
            console.warn(`Returning stale data for ${cacheKey} due to error.`);
            return staleData;
        }
        throw error;
    }
}

// Helper function to process raw data into metas
async function processRawData(rawData, type) {
    const imdbPromises = rawData.map(item => getImdbId(item.title, item['release-year']).catch(() => null));
    const imdbResults = await Promise.allSettled(imdbPromises);

    const metadataPromises = imdbResults.map((result, index) =>
        result.status === 'fulfilled' && result.value ? getMetadata(result.value, type).catch(() => null) : null
    );
    const metadataResults = await Promise.allSettled(metadataPromises);

    return Promise.all(
        rawData.map(async (item, index) => {
            const imdbId = imdbResults[index]?.status === 'fulfilled' ? imdbResults[index].value : null;
            const meta = metadataResults[index]?.status === 'fulfilled' ? metadataResults[index].value : null;
            const id = imdbId || `binged:${item.id}`;

            let poster = imdbId ? `https://live.metahub.space/poster/small/${imdbId}/img` : item.image;
            let background = imdbId ? `https://live.metahub.space/background/medium/${imdbId}/img` : item.image;

            const [posterAvailable] = await Promise.all([isUrlAvailable(poster)]);
            if (!posterAvailable) poster = item.image;

            return {
                id, 
                type, 
                name: decodeTitle(item.title),
                poster, 
                posterShape: 'poster', background,
                description: meta?.description || `${decodeTitle(item.title)} (${item['release-year']}) - ${item.genre}`,
                recommendation: item.recommendation || "",
                releaseInfo: item['release-year'] ? `${item['release-year']}` : (item['streaming-date'] || "Unknown"),
                genres: meta?.genres || item.genre.split(', '),
                languages: item.languages ? item.languages.split(', ') : [],
                cast: meta?.cast || [], director: meta?.director || [], writer: meta?.writer || [],
                imdbRating: meta?.imdbRating || null, runtime: meta?.runtime || null,
                trailers: meta?.trailers || [], links: meta?.links || []
            };
        })
    );
}


// Function to check if RPDB key is valid
async function validateRPDBKey(rpdbKey) {
    try {
        const response = await fetch(`https://api.ratingposterdb.com/${rpdbKey}/isValid`);
        const data = await response.json();
        return data?.valid === true; // Return true if the key is valid
    } catch (e) {
        // Handle error (e.g., network issue, invalid key, etc.)
        return false; // Return false if validation fails
    }
}

// Define catalog handler
builder.defineCatalogHandler(async (args) => {
    const type = args.type;

    if (type !== 'movie' && type !== 'series') {
        console.log(`Skipping Invalid Type: ${type}`);
        return { metas: [] };
    }

    const config = args.config || {}; 
    const selectedLanguage = args.extra?.genre;
    const globalCacheKey = `global-${type}`;
    const selectedRecommendation = args.extra?.recommendation;

    // Step 1: Fetch raw global data (cached)
    let globalData = cache.get(globalCacheKey);
    if (!globalData) {
        try {
            globalData = await fetchAndCacheGlobalData(type);
            cache.set(globalCacheKey, globalData);
            console.log(`Cached Raw Global Data For: ${globalCacheKey}`);
        } catch (error) {
            console.error(`Failed To Fetch Global Data: ${error.message}`);
            return { metas: [] };
        }
    }

    // Step 2: Validate RPDB API key (cached)
    let isRPDBKeyValid = false;
    const rpdbCacheKey = `rpdb-valid-${config.rpdbApiKey}`;
    if (config?.rpdbApiKey) {
        isRPDBKeyValid = cache.get(rpdbCacheKey) ?? await validateRPDBKey(config.rpdbApiKey).catch(err => {
            console.error(`Failed To Validate RPDB Key: ${err.message}`);
            return false;
        });
        cache.set(rpdbCacheKey, isRPDBKeyValid);
        !isRPDBKeyValid && console.log('RPDB API Key Is Invalid');
    }

    // Step 3: Apply RPDB poster updates (if API key is valid)
    let metasToReturn = globalData.map(meta => {
        if (isRPDBKeyValid && meta.id && /^tt\d+$/.test(meta.id)) {
            return { 
                ...meta, 
                poster: `https://api.ratingposterdb.com/${config.rpdbApiKey}/imdb/poster-default/${meta.id}.jpg?fallback=true`
            };
        }
        return meta;
    });

    // Step 4: Filter by language (if selected)
    if (selectedLanguage) {
        console.log(`Filtering Data For Language: ${selectedLanguage}`);
        metasToReturn = metasToReturn.filter(item =>
            Array.isArray(item.languages) && item.languages.includes(selectedLanguage)
        );
    }
    // Step 5: Filter by recommendation (if selected)
    if (selectedRecommendation && filters.includes(selectedRecommendation)) {
        console.log(`Filtering Data For Recommendation: ${selectedRecommendation}`);
        metasToReturn = metasToReturn.filter(item => {
            // Map the alphabetic recommendation to its human-readable equivalent
            const mappedRecommendation = recommendationMapping[item.recommendation];
            return mappedRecommendation === selectedRecommendation;
        });
    }


    return { metas: metasToReturn };
});


serveHTTP(builder.getInterface(), { port: 7000, cacheMaxAge: 3600, staleRevalidate:3600, staleError:3600 });

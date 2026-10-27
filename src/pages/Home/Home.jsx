import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { balancedStoreProductPreview, uniqueStoreProductListings, uniqueCatalogProducts } from '../../utils/storeProductListings';
import { Box, Typography, Button, Chip, MenuItem, Select } from '@mui/material';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CottageOutlinedIcon from '@mui/icons-material/CottageOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import SortOutlinedIcon from '@mui/icons-material/SortOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/Header/Header';
import CategoryNav from '../../components/CategoryNav/CategoryNav';
import ProductSection from '../../components/ProductSection/ProductSection';
import ProductCard from '../../components/ProductCard/ProductCard';
import CategoryCircle from '../../components/CategoryCircle/CategoryCircle';
import CampaignCarousel from '../../components/CampaignCarousel/CampaignCarousel';
import BottomNav from '../../components/BottomNav/BottomNav';
import { AppContext } from '../../context/AppContext';
import { promotionApplies } from '../../services/promotionScope';
import { getCategoryProducts, getProducts } from '../../services/catalogApi';
import { adaptProductList } from '../../services/catalogAdapter';
import { deliverySummary, storeDeliversTo, deliveryDistanceKm, deliveryProducts, isGlobalStore } from '../../utils/storeDelivery';
import { filterAndSortProducts, prepareBrowseProduct, parseDeliveryEstimate } from '../../utils/productBrowsing.js';
import { useBrowseDeliveryQuotes } from '../../hooks/useBrowseDeliveryQuotes';
import { getProductReviewsBatch } from '../../services/reviewApi';
import './Home.css';

const OTHER_SUBCATEGORY_CATEGORIES = ['Traditional Pickles', 'Premium Dry Fruits', 'Fresh Vegetables', 'Fresh Non-Veg'];


const Home = () => {
  const [reviews, setReviews] = useState([]);
  const location = useLocation();
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [showSearchSort, setShowSearchSort] = useState(false);
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchPrice, setSearchPrice] = useState('all');
  const [searchRating, setSearchRating] = useState('all');
  const [searchAvailability, setSearchAvailability] = useState('all');
  const [searchSort, setSearchSort] = useState('popularity');
  const [storeFilter, setStoreFilter] = useState('all');
  const [collection, setCollection] = useState('');
  const [collectionEntry, setCollectionEntry] = useState(location.key);
  if (collectionEntry !== location.key) {
    setCollectionEntry(location.key);
    setCollection('');
  }
  const navigate = useNavigate();
  const {
    selectedCategory,
    setSelectedCategory,
    homeSearchQuery,
    setHomeSearchQuery,
    t,
    userCity,
    selectedLocation,
    addresses,
    setShowLocationModal,
    catalogProducts,
    catalogStoreProducts,
    catalogCategories,
    catalogBanners,
    catalogStores: stores,
    catalogLoading,
    catalogError,
    loadCatalog,
    formatCurrency,
    setDeliveryMode,
    selectStore,
  } = useContext(AppContext);
  useEffect(() => {
    let active = true;
    const ids = catalogProducts.map((product) => product.productId || product.id).filter(Boolean);
    getProductReviewsBatch(ids).then((rows) => { if (active) setReviews(rows || []); }).catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [catalogProducts]);
  useLayoutEffect(() => {
    if (location.state?.resetHome) {
      setHomeSearchQuery('');
      setSelectedCategory('All');
    }
  }, [location.key, location.state?.resetHome, setHomeSearchQuery, setSelectedCategory]);

  const [filteredCatalogResult, setFilteredCatalogResult] = useState({ key: '', products: [] });
  const [filterLoading, setFilterLoading] = useState(false);

  const selectedCategoryData = catalogCategories.find((item) =>
    item.name === selectedCategory || item.title === selectedCategory || item.id === selectedCategory || item.slug === selectedCategory
  );
  const categoryRequestKey = `${selectedCategoryData?.id || ''}:${homeSearchQuery.trim()}`;

  useEffect(() => {
    const category = catalogCategories.find((item) =>
      item.name === selectedCategory || item.title === selectedCategory || item.id === selectedCategory || item.slug === selectedCategory
    );
    const shouldFetch = Boolean((selectedCategory && selectedCategory !== 'All') || homeSearchQuery.trim());
    if (!shouldFetch) {
      const timer = window.setTimeout(() => { setFilteredCatalogResult({ key: '', products: [] }); setFilterLoading(false); }, 0);
      return () => window.clearTimeout(timer);
    }
    let ignore = false;
    const loadingTimer = window.setTimeout(() => setFilterLoading(true), 0);
    const query = homeSearchQuery.trim();
    const params = { status: 'ACTIVE', search: query || undefined, q: query || undefined };
    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => {
      const request = category?.id && selectedCategory !== 'All'
        ? getCategoryProducts(category.id, params, { signal: controller.signal })
        : getProducts(params, { signal: controller.signal });
      request
      .then((payload) => {
        if (!ignore) setFilteredCatalogResult({
          key: `${category?.id || ''}:${query}`,
          products: adaptProductList(payload || []),
        });
      })
      .catch(() => {
        if (!ignore && !controller.signal.aborted) setFilteredCatalogResult({ key: `${category?.id || ''}:${query}`, products: [] });
      })
      .finally(() => {
        if (!ignore) setFilterLoading(false);
      });
    }, 300);
    return () => {
      ignore = true;
      window.clearTimeout(loadingTimer);
      window.clearTimeout(requestTimer);
      controller.abort();
    };
  }, [selectedCategory, homeSearchQuery, catalogCategories]);

  const inferSubcategory = (item) => {
    const rawSubcategory = item.subcategory || item.subCategory || item.subcategoryName || item.subCategoryName;
    const explicit = typeof rawSubcategory === 'object'
      ? rawSubcategory.name || rawSubcategory.title
      : rawSubcategory;
    if (String(explicit || '').trim()) return String(explicit).trim();
    if (OTHER_SUBCATEGORY_CATEGORIES.includes(item.category)) return '';
    if (item.category === 'Spice powder') return 'Powdered Spices';
    if (item.category === 'Whole Masala') return 'Whole Spices';
    if (item.category === 'Masalas') return 'Blended Masalas';
    if (item.category === 'Dry Fruits') return /raisin|date/i.test(item.name || item.title) ? 'Dried Fruits' : 'Nuts';
    return 'Other';
  };
  // Reference data comes from the catalog service.
  const banners = catalogBanners;

  const allMasterProducts = useMemo(() => catalogProducts
    .filter((item) => item.status !== 'Inactive' && item.active !== false)
    .map((item) => {
      const product = item;
      return { ...product, title: product.title || product.name || 'Product', subcategory: inferSubcategory(item) };
    }), [catalogProducts]);

  const sharedCategories = useMemo(() => catalogCategories
    .filter((item) => item.status !== 'Inactive' && item.active !== false)
    .sort((a,b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)), [catalogCategories]);
  const sharedStores = useMemo(() => stores.filter((store) => storeDeliversTo(store, selectedLocation) || isGlobalStore(store))
    .sort((a, b) => deliveryDistanceKm(a, selectedLocation) - deliveryDistanceKm(b, selectedLocation)), [stores, selectedLocation]);
  const deliveryPool = useMemo(() => deliveryProducts(allMasterProducts, catalogStoreProducts, stores, selectedLocation), [allMasterProducts, catalogStoreProducts, stores, selectedLocation]);
  const quotedProducts = useBrowseDeliveryQuotes(deliveryPool, selectedLocation, addresses);
  const availableProductPool = quotedProducts.map(product => prepareBrowseProduct(product, stores, reviews));
  const categoryApiProducts = useMemo(
    () => filteredCatalogResult.key === categoryRequestKey && selectedCategoryData ? filteredCatalogResult.products : [],
    [filteredCatalogResult, categoryRequestKey, selectedCategoryData]
  );
  const categoryDeliveryPool = useMemo(
    () => deliveryProducts(categoryApiProducts, catalogStoreProducts, stores, selectedLocation),
    [categoryApiProducts, catalogStoreProducts, stores, selectedLocation]
  );
  const quotedCategoryProducts = useBrowseDeliveryQuotes(categoryDeliveryPool, selectedLocation, addresses);
  const availableCategoryProductPool = quotedCategoryProducts.map(product => prepareBrowseProduct(product, stores, reviews));
  const visibleStores = useMemo(() => {
    const baseStores = sharedStores;
    const storeHasOffer = (store) => {
      const hasProductOffer = catalogProducts.some((product) => (product.storeId === store.id || product.store === store.name || product.storeName === store.name || (isGlobalStore(store) && product.globalProduct)) && (product.offer || Number(product.compareAtPrice || 0) > Number(product.price || 0)));
      return hasProductOffer;
    };
    const storeEtaMinutes = (store) => parseDeliveryEstimate(store.deliveryEtaMinutes ?? store.etaMinutes ?? store.estimatedDeliveryMinutes)?.max ?? null;
    const enriched = baseStores.map((store) => {
      const etaMinutes = storeEtaMinutes(store);
      return {
        ...store,
        hasOffer: storeHasOffer(store),
        etaMinutes,
        under30: etaMinutes !== null && etaMinutes < 30,
        above30: etaMinutes > 30,
        isNew: store.isNew === true,
      };
    });
    return enriched
      .filter((store) => storeFilter === 'all' || (storeFilter === 'offers' ? store.hasOffer : storeFilter === 'under30' ? store.under30 : storeFilter === 'above30' ? store.above30 : store.isNew))
      .sort((a, b) => storeFilter === 'new' ? Number(b.isNew) - Number(a.isNew) || deliveryDistanceKm(a, selectedLocation) - deliveryDistanceKm(b, selectedLocation) : ['under30', 'above30'].includes(storeFilter) ? (a.etaMinutes || 999) - (b.etaMinutes || 999) : Number(b.hasOffer) - Number(a.hasOffer) || (a.etaMinutes || 999) - (b.etaMinutes || 999));
  }, [catalogProducts, selectedLocation, sharedStores, storeFilter]);
  const nearbyProducts = useMemo(() => {
    const nearbyLocalStores = stores.filter((store) => !isGlobalStore(store) && storeDeliversTo(store, selectedLocation));
    const nearbyStoreIds = new Set(nearbyLocalStores.map((store) => String(store.id)));
    const nearbyStoreNames = new Set(nearbyLocalStores.map((store) => String(store.name)));
    return availableProductPool.filter((product) =>
      nearbyStoreIds.has(String(product.storeId)) ||
      nearbyStoreNames.has(String(product.store || product.storeName))
    );
  }, [availableProductPool, selectedLocation, stores]);

  const activeBanners = useMemo(() => {
    const now = new Date();
    return banners.filter((item) => {
      if (item.status !== 'Active' || item.active === false) return false;
      const startsAt = item.startDate ? new Date(`${item.startDate}T00:00:00`) : null;
      const endsAt = item.endDate ? new Date(`${item.endDate}T23:59:59.999`) : null;
      return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now) && promotionApplies(item, { location: userCity });
    });
  }, [banners, userCity]);

  const subcategories = useMemo(() => {
    if (selectedCategory === 'All') return [];
    const existing = [...new Set(availableProductPool
      .filter((item) => item.category === selectedCategory)
      .map((item) => String(item.subcategory || '').trim())
      .filter(Boolean))];
    if (OTHER_SUBCATEGORY_CATEGORIES.includes(selectedCategory)
      && !existing.some((name) => name.toLowerCase() === 'other')) existing.push('Other');
    return existing;
  }, [availableProductPool, selectedCategory]);
  const effectiveSubcategory = subcategories.includes(selectedSubcategory) ? selectedSubcategory : 'All';
  const catalogApiProducts = selectedCategoryData ? availableCategoryProductPool : availableProductPool;
  const productCardKey = (product, suffix = '') => `${product.storeId || product.store || 'store'}:${product.productId || product.id || product.title}${suffix}`;
  const uniqueByProduct = uniqueStoreProductListings;
  const merchProducts = (flag) => uniqueByProduct(availableProductPool.filter((item) => item[flag] === 'Yes' || item[flag] === true));

  const getCategoryItems = () => {
    if (collection && selectedCategory === 'All' && !homeSearchQuery.trim()) {
      return collection === 'nearby' ? uniqueByProduct(nearbyProducts)
        : collection === 'recommended' ? uniqueByProduct(availableProductPool)
        : collection === 'Traditional Pickles' || collection === 'Premium Dry Fruits'
          ? uniqueByProduct(availableProductPool.filter((item) => item.category === collection))
          : merchProducts(collection);
    }
    const baseCategoryPool = selectedCategory && selectedCategory !== 'All'
      ? catalogApiProducts.filter((item) => {
        const productCategoryId = item.categoryId ?? item.category?.id;
        const categoryMatches = selectedCategoryData?.id && productCategoryId != null
          ? String(productCategoryId) === String(selectedCategoryData.id)
          : categoryApiProducts.length > 0
            || [item.category?.name, item.category, item.categoryName, item.categorySlug]
              .some((value) => String(value || '').trim().toLowerCase() === String(selectedCategoryData?.name || selectedCategory).trim().toLowerCase()
                || String(value || '').trim().toLowerCase() === String(selectedCategoryData?.slug || '').trim().toLowerCase());
        const itemSubcategory = String(item.subcategory || '').trim();
        return categoryMatches && (effectiveSubcategory === 'All' || itemSubcategory.toLowerCase() === effectiveSubcategory.toLowerCase());
      })
      : null;

    if (homeSearchQuery && homeSearchQuery.trim()) {
      const searchPool = baseCategoryPool || catalogApiProducts;
      return filterAndSortProducts(searchPool, {
        query: homeSearchQuery, nameOnly: true, category: searchCategory, maxPrice: searchPrice,
        rating: searchRating, availability: searchAvailability, sort: searchSort,
      });
    }

    return baseCategoryPool ? uniqueByProduct(baseCategoryPool) : null;
  };

  const categoryItems = getCategoryItems();
  const activeCategoryProducts = categoryItems ? uniqueCatalogProducts(categoryItems) : null;
  const searchFilterCount = [searchCategory,searchPrice,searchRating,searchAvailability].filter((value) => value !== 'all').length;
  const resetSearchFilters = () => { setSearchCategory('all'); setSearchPrice('all'); setSearchRating('all'); setSearchAvailability('all'); };

  return (
    <Box className="home-wrapper">
      <Header />
      {selectedLocation && !catalogLoading && !catalogError && sharedStores.length === 0 && <Box sx={{ p: 2, textAlign: 'center' }}><Typography>No stores currently deliver to {selectedLocation.address || selectedLocation.city}.</Typography><Button onClick={() => setShowLocationModal(true)}>Change location</Button></Box>}
      <CategoryNav />
      {subcategories.length > 0 && <Box className="subcategory-nav"><Button className={effectiveSubcategory === 'All' ? 'active' : ''} onClick={() => setSelectedSubcategory('All')}>All</Button>{subcategories.map((name) => <Button key={name} className={effectiveSubcategory === name ? 'active' : ''} onClick={() => setSelectedSubcategory(name)}>{name}</Button>)}</Box>}

      <Box className="home-content-scroll">
        {collection && <Button onClick={() => setCollection('')}>Back to home</Button>}
        {(catalogLoading || filterLoading) && <Box style={{ padding: '16px 4vw' }}><Typography>Loading catalog…</Typography></Box>}
        {catalogError && !catalogLoading && <Box style={{ padding: '16px 4vw' }}><Typography color="error">{catalogError}</Typography><Button onClick={loadCatalog}>Retry products</Button></Box>}
        {homeSearchQuery && <Box className="home-search-controls" sx={{ mx: '4vw', mt: 2 }}>
          <Box className="home-search-actions">
            <Button variant={showSearchFilters || searchFilterCount ? 'contained' : 'outlined'} startIcon={<FilterListOutlinedIcon />} onClick={() => { setShowSearchFilters((value) => !value); setShowSearchSort(false); }}>Filter{searchFilterCount ? ` (${searchFilterCount})` : ''}</Button>
            <Button variant={showSearchSort || searchSort !== 'popularity' ? 'contained' : 'outlined'} startIcon={<SortOutlinedIcon />} onClick={() => { setShowSearchSort((value) => !value); setShowSearchFilters(false); }}>Sort</Button>
            {searchFilterCount > 0 && <Button className="home-search-clear" onClick={resetSearchFilters}>Clear All Filters</Button>}
          </Box>
          {showSearchFilters && <Box className="home-search-panel">
            <Select size="small" value={searchCategory} onChange={(event) => setSearchCategory(event.target.value)}><MenuItem value="all">All Categories</MenuItem>{sharedCategories.map((category) => <MenuItem key={category.id} value={category.name}>{category.name}</MenuItem>)}</Select>
            <Select size="small" value={searchPrice} onChange={(event) => setSearchPrice(event.target.value)}><MenuItem value="all">All Prices</MenuItem><MenuItem value="150">Under ₹150</MenuItem><MenuItem value="200">Under ₹200</MenuItem><MenuItem value="300">Under ₹300</MenuItem></Select>
            <Select size="small" value={searchRating} onChange={(event) => setSearchRating(event.target.value)}><MenuItem value="all">All Ratings</MenuItem><MenuItem value="4">4 stars & above</MenuItem><MenuItem value="5">5 stars only</MenuItem></Select>
            <Select size="small" value={searchAvailability} onChange={(event) => setSearchAvailability(event.target.value)}><MenuItem value="all">All Availability</MenuItem><MenuItem value="pickup">Pickup Available</MenuItem><MenuItem value="under30">Under 30 min</MenuItem></Select>
            {searchFilterCount > 0 && <Button onClick={resetSearchFilters}>Reset filters</Button>}
          </Box>}
          {showSearchSort && <Box className="home-search-panel home-sort-panel"><Select size="small" value={searchSort} onChange={(event) => setSearchSort(event.target.value)}><MenuItem value="popularity">Popularity</MenuItem><MenuItem value="newest">Newest</MenuItem><MenuItem value="price-low">Price Low to High</MenuItem><MenuItem value="price-high">Price High to Low</MenuItem><MenuItem value="pickup">Pickup</MenuItem><MenuItem value="offers">Offers</MenuItem><MenuItem value="under30">Delivery time: fastest first</MenuItem></Select></Box>}
        </Box>}
        {activeCategoryProducts ? (
          activeCategoryProducts.length > 0 ? (
            <Box style={{ padding: '16px 4vw' }}>
              <Typography variant="h6" style={{ fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>
                {homeSearchQuery ? `Results for "${homeSearchQuery}"` : `${collection || selectedCategory} Products`} ({activeCategoryProducts.length})
              </Typography>

              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {activeCategoryProducts.map((item) => (
                  <ProductCard key={`${productCardKey(item)}:${item.variantId || item.selectedVariant?.id || ''}`} {...item} />
                ))}
              </Box>
            </Box>
          ) : (
            <Box className="no-products-found">
              <Box className="no-products-content">
                <SearchOffOutlinedIcon style={{ fontSize: 64, color: '#94a3b8', marginBottom: 12 }} />
                <Typography className="no-products-title">
                  {t('noProducts')}
                </Typography>
                <Typography className="no-products-subtitle">
                  We couldn't find any products matching "{homeSearchQuery || selectedCategory}".
                </Typography>
                {homeSearchQuery && <Button sx={{ mt:2 }} variant="outlined" onClick={resetSearchFilters}>Clear All Filters</Button>}
              </Box>
            </Box>
          )
        ) : (
          <>
            {activeBanners.length > 0 && <CampaignCarousel banners={activeBanners} onNavigate={navigate}/>}

            <ProductSection title={t('shopCategories')} hasViewAll={false}>
              {sharedCategories.map((cat) => <CategoryCircle key={cat.id} title={cat.name} image={cat.image} onClick={() => setSelectedCategory(cat.name)} />)}
            </ProductSection>

            <ProductSection title={t('featured')} onViewAll={() => setCollection('featured')}>
              {balancedStoreProductPreview(merchProducts('featured')).map((prod) => <ProductCard key={productCardKey(prod)} {...prod} />)}
            </ProductSection>

            <ProductSection title={t('special')} onViewAll={() => setCollection('special')}>
              {balancedStoreProductPreview(merchProducts('special')).map((prod) => <ProductCard key={productCardKey(prod)} {...prod} />)}
            </ProductSection>

            <ProductSection title={t('newArrivals')} onViewAll={() => setCollection('newArrival')}>
              {balancedStoreProductPreview(merchProducts('newArrival')).map((prod) => <ProductCard key={productCardKey(prod)} {...prod} />)}
            </ProductSection>

            <ProductSection title={t('recommended')} onViewAll={() => setCollection('recommended')}>
              {balancedStoreProductPreview(availableProductPool).map((prod) => <ProductCard key={productCardKey(prod)} {...prod} />)}
            </ProductSection>

            <ProductSection title={t('availableNearYou')} onViewAll={() => setCollection('nearby')}>
              {nearbyProducts.slice(0,12).map((prod) => <ProductCard key={`${prod.storeId || 'store'}:${prod.id}`} {...prod} />)}
            </ProductSection>

            <Box sx={{ px:'4vw', py:2 }}>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2, mb:1 }}>
                <Typography className="section-title">{t('shopsNearYou')}</Typography>
                <Button size="small" onClick={() => navigate('/stores')}>{t('viewAll')}</Button>
              </Box>
              <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', mb:2 }}>
                {[{id:'all',label:'All'}, {id:'offers',label:'Offers'}, {id:'under30',label:'Under 30 mins'}, {id:'above30',label:'Above 30 mins'}, {id:'new',label:'New'}].map((filter) => <Chip key={filter.id} clickable label={filter.label} color={storeFilter === filter.id ? 'success' : 'default'} onClick={() => setStoreFilter(filter.id)} />)}
              </Box>
              <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(128px, 1fr))', gap:2 }}>
                {visibleStores.map((store) => { const delivery = deliverySummary(store, formatCurrency); const openStore = () => { if (!store.id) return; const targetStoreId = store.id; setDeliveryMode('delivery'); selectStore(targetStoreId); navigate(`/stores/${encodeURIComponent(targetStoreId)}`); }; return <Box key={store.id} role="button" tabIndex={0} onClick={openStore} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openStore(); } }} sx={{ cursor:'pointer', textAlign:'center', p:1, border:'1px solid #e2e8f0', borderRadius:3, bgcolor:'#fff' }}>
                  <Box sx={{ width:64, height:64, mx:'auto', borderRadius:'50%', bgcolor:'#eef8f3', display:'grid', placeItems:'center', overflow:'hidden', border:'1px solid #d8eee5' }}><StorefrontOutlinedIcon sx={{ color:'#075F40' }} /></Box>
                  <Typography sx={{ mt:1, fontWeight:800, fontSize:13 }} noWrap>{store.name}</Typography>
                  {store.hasOffer && <Typography sx={{ color:'#dc2626', fontSize:11, fontWeight:800 }}>Offer</Typography>}
                  <Typography sx={{ color:'#64748b', fontSize:12 }}>{delivery.etaLabel}</Typography>
                </Box>; })}
                {visibleStores.length === 0 && <Typography color="text.secondary" sx={{ gridColumn:'1 / -1' }}>
                  {storeFilter === 'above30' ? 'No stores with delivery above 30 minutes are available for this location.' : `No stores match the selected ${storeFilter === 'under30' ? 'Under 30 mins' : storeFilter === 'offers' ? 'Offers' : 'New'} filter.`}
                </Typography>}
              </Box>
            </Box>

            <Box className="categories-and-promo-section">
              <Box className="shop-by-categories">
                <ProductSection title={t('bestSellers')} subtitle="Here's what everyone's loving!" onViewAll={() => setCollection('bestSeller')}>
                  {merchProducts('bestSeller').slice(0,12).map((prod, idx) => <ProductCard key={productCardKey(prod, `:${idx}`)} {...prod} />)}
                </ProductSection>
              </Box>
              <Box className="promo-banner-container">
                <Box className="promo-banner-left">
                  <Box className="promo-welcome-tag">
                    <LocalOfferOutlinedIcon fontSize="small" /> Welcome Offer
                  </Box>
                  <Typography className="promo-title-text">
                    Get <span className="highlight-off">20% OFF</span>
                  </Typography>
                  <Box className="promo-pill-button">
                    ON FIRST 3 ORDERS
                  </Box>
                </Box>
              </Box>
            </Box>

            <ProductSection title={t('traditionalPickles')} onViewAll={() => setCollection('Traditional Pickles')}>
              {uniqueByProduct(availableProductPool.filter((item) => item.category === 'Traditional Pickles')).slice(0,12).map((prod) => (
                <ProductCard key={productCardKey(prod)} {...prod} />
              ))}
            </ProductSection>

            <ProductSection title={t('premiumDryFruits')} onViewAll={() => setCollection('Premium Dry Fruits')}>
              {uniqueByProduct(availableProductPool.filter((item) => item.category === 'Premium Dry Fruits')).slice(0,12).map((prod) => (
                <ProductCard key={productCardKey(prod)} {...prod} />
              ))}
            </ProductSection>

            <Box className="why-us-section">
              <Typography className="section-title">{t('whyUs')}</Typography>
              <Box className="why-us-grid">
                {[
                  { title: '100% Homemade', subtitle: 'No preservatives', icon: <CottageOutlinedIcon /> },
                  { title: 'Authentic Taste', subtitle: 'Traditional recipes', icon: <RestaurantOutlinedIcon /> },
                  { title: 'Premium Quality', subtitle: 'Finest ingredients', icon: <WorkspacePremiumOutlinedIcon /> },
                  { title: 'Hygienically Packed', subtitle: 'Safe & pure', icon: <VerifiedUserOutlinedIcon /> }
                ].map((item, idx) => (
                  <Box key={idx} className="why-us-item">
                    <Box className="why-us-icon-placeholder">{item.icon}</Box>
                    <Typography className="why-us-item-title">{item.title}</Typography>
                    <Typography className="why-us-item-subtitle">{item.subtitle}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </Box>

      <button
        type="button"
        className="home-meta-ai-help"
        aria-label="Open help center"
        title="Meta AI Help"
        onClick={() => navigate('/help-center')}
      >
        <span className="home-meta-ai-ring" />
        <span className="home-meta-ai-label">{t('help')}</span>
      </button>

      <BottomNav />


    </Box>
  );
};

export default Home;






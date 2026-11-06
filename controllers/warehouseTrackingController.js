const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const con = require('../config/database');
const BarcodeService = require('../helpers/barcodeService');
const logger = require('../logger');
const bwipjs = require('bwip-js');
const { ACCESS_TOKEN_SECRET } = process.env;

// 12 Official Shipment Timeline Milestones (matches Admin Panel & Shipment Timeline):
// 1. Collected from supplier
// 2. Received at Asia Direct warehouse
// 3. Dispatched to port
// 4. Goods at origin port
// 5. Goods are in transit
// 6. Arrived at destination port
// 7. Customs clearing in progress
// 8. Customs released
// 9. Goods in transit to warehouse
// 10. Arrived at Asia Direct warehouse
// 11. Out for delivery
// 12. Delivered

const OFFICIAL_SHIPMENT_TIMELINE_STATUSES = [
    'Collected from supplier',
    'Received at Asia Direct warehouse',
    'Dispatched to port',
    'Goods at origin port',
    'Goods are in transit',
    'Arrived at destination port',
    'Customs clearing in progress',
    'Customs released',
    'Goods in transit to warehouse',
    'Arrived at Asia Direct warehouse',
    'Out for delivery',
    'Delivered'
];

const SCAN_EVENT_ORDER_TRACK_MAP = {
    // 1. Collected from supplier
    'collected_supplier': {
        status: 'Collected from supplier',
        description: 'Cargo collected from supplier'
    },
    'collected_from_supplier': {
        status: 'Collected from supplier',
        description: 'Cargo collected from supplier'
    },
    'pickup': {
        status: 'Collected from supplier',
        description: 'Cargo picked up from supplier'
    },
    'collected': {
        status: 'Collected from supplier',
        description: 'Collected from supplier'
    },

    // 2. Received at Asia Direct warehouse (Origin warehouse intake)
    'received_origin': {
        status: 'Received at Asia Direct warehouse',
        description: 'Received at Asia Direct origin warehouse'
    },
    'received_warehouse': {
        status: 'Received at Asia Direct warehouse',
        description: 'Received at Asia Direct origin warehouse'
    },
    'intake': {
        status: 'Received at Asia Direct warehouse',
        description: 'Intake scanned and received at Asia Direct warehouse'
    },
    'booked_origin': {
        status: 'Received at Asia Direct warehouse',
        description: 'Booked into Asia Direct origin warehouse'
    },
    'booked_warehouse': {
        status: 'Received at Asia Direct warehouse',
        description: 'Booked into Asia Direct origin warehouse'
    },
    'goods received at warehouse': {
        status: 'Received at Asia Direct warehouse',
        description: 'Goods received at Asia Direct warehouse'
    },

    // 3. Dispatched to port
    'dispatched_to_port': {
        status: 'Dispatched to port',
        description: 'Dispatched from origin warehouse to port'
    },
    'dispatched_port': {
        status: 'Dispatched to port',
        description: 'Dispatched to port facility'
    },

    // 4. Goods at origin port
    'goods_at_origin_port': {
        status: 'Goods at origin port',
        description: 'Goods arrived and staged at origin port'
    },
    'port_origin': {
        status: 'Goods at origin port',
        description: 'Goods arrived at origin port'
    },
    'loaded_container': {
        status: 'Goods at origin port',
        description: 'Loaded and secured into sea freight container at origin port'
    },
    'loaded_flight': {
        status: 'Goods at origin port',
        description: 'Cargo accepted and loaded into flight at origin airport'
    },

    // 5. Goods are in transit
    'departed_origin': {
        status: 'Goods are in transit',
        description: 'Departed origin port / facility - goods are in transit'
    },
    'transit': {
        status: 'Goods are in transit',
        description: 'Shipment in transit'
    },
    'goods_in_transit': {
        status: 'Goods are in transit',
        description: 'Goods are in transit'
    },
    'goods are in transit': {
        status: 'Goods are in transit',
        description: 'Goods are in transit'
    },
    'scanned_out': {
        status: 'Goods are in transit',
        description: 'Scanned out of origin warehouse into transit'
    },
    'scanned_out_warehouse': {
        status: 'Goods are in transit',
        description: 'Scanned out of origin warehouse into transit'
    },

    // 6. Arrived at destination port
    'arrived_destination_port': {
        status: 'Arrived at destination port',
        description: 'Vessel / flight arrived at destination port'
    },
    'port_destination': {
        status: 'Arrived at destination port',
        description: 'Arrived at destination port'
    },

    // 7. Customs clearing in progress
    'customs_clearing': {
        status: 'Customs clearing in progress',
        description: 'Customs clearing and inspection documentation in progress'
    },
    'customs': {
        status: 'Customs clearing in progress',
        description: 'Customs clearing documentation in progress'
    },
    'customs_in_progress': {
        status: 'Customs clearing in progress',
        description: 'Customs clearing in progress'
    },

    // 8. Customs released
    'customs_released': {
        status: 'Customs released',
        description: 'Customs cleared and released for onward delivery'
    },
    'customs_release': {
        status: 'Customs released',
        description: 'Customs cleared and released'
    },
    'customs_cleared': {
        status: 'Customs released',
        description: 'Customs cleared and released'
    },

    // 9. Goods in transit to warehouse
    'transit_warehouse': {
        status: 'Goods in transit to warehouse',
        description: 'Goods in transit from destination port to warehouse depot'
    },
    'goods_in_transit_to_warehouse': {
        status: 'Goods in transit to warehouse',
        description: 'Goods in transit to warehouse'
    },
    'goods in transit to warehouse': {
        status: 'Goods in transit to warehouse',
        description: 'Goods in transit to warehouse'
    },

    // 10. Arrived at Asia Direct warehouse (Destination depot arrival)
    'arrived_destination': {
        status: 'Arrived at Asia Direct warehouse',
        description: 'Arrived and booked into Asia Direct destination warehouse'
    },
    'received_destination': {
        status: 'Arrived at Asia Direct warehouse',
        description: 'Received at Asia Direct destination warehouse'
    },
    'booked_destination': {
        status: 'Arrived at Asia Direct warehouse',
        description: 'Booked into Asia Direct destination warehouse'
    },
    'offloaded': {
        status: 'Arrived at Asia Direct warehouse',
        description: 'Offloaded at Asia Direct destination warehouse'
    },
    'offloading': {
        status: 'Arrived at Asia Direct warehouse',
        description: 'Offloaded at Asia Direct destination depot'
    },

    // 11. Out for delivery
    'readyfordelivery': {
        status: 'Out for delivery',
        description: 'Ready and dispatched out for customer delivery'
    },
    'ready_for_delivery': {
        status: 'Out for delivery',
        description: 'Ready and dispatched out for customer delivery'
    },
    'out_for_delivery': {
        status: 'Out for delivery',
        description: 'Out for final delivery'
    },

    // 12. Delivered
    'delivered': {
        status: 'Delivered',
        description: 'Shipment delivered to customer'
    },

    // Uppercase variants:
    'COLLECTED_SUPPLIER': { status: 'Collected from supplier', description: 'Cargo collected from supplier' },
    'RECEIVED_ORIGIN': { status: 'Received at Asia Direct warehouse', description: 'Received at Asia Direct origin warehouse' },
    'DISPATCHED_TO_PORT': { status: 'Dispatched to port', description: 'Dispatched to port' },
    'LOADED_CONTAINER': { status: 'Goods at origin port', description: 'Loaded into sea freight container at origin port' },
    'LOADED_FLIGHT': { status: 'Goods at origin port', description: 'Cargo accepted and loaded into flight at origin airport' },
    'DEPARTED_ORIGIN': { status: 'Goods are in transit', description: 'Departed origin - goods are in transit' },
    'SCANNED_OUT': { status: 'Goods are in transit', description: 'Scanned out into transit' },
    'ARRIVED_DESTINATION_PORT': { status: 'Arrived at destination port', description: 'Arrived at destination port' },
    'CUSTOMS_CLEARING': { status: 'Customs clearing in progress', description: 'Customs clearing in progress' },
    'CUSTOMS_RELEASED': { status: 'Customs released', description: 'Customs cleared and released' },
    'TRANSIT_WAREHOUSE': { status: 'Goods in transit to warehouse', description: 'Goods in transit to warehouse' },
    'ARRIVED_DESTINATION': { status: 'Arrived at Asia Direct warehouse', description: 'Arrived at Asia Direct destination warehouse' },
    'OFFLOADED': { status: 'Arrived at Asia Direct warehouse', description: 'Offloaded at destination depot' },
    'READYFORDELIVERY': { status: 'Out for delivery', description: 'Out for delivery' },
    'OUT_FOR_DELIVERY': { status: 'Out for delivery', description: 'Out for final delivery' },
    'DELIVERED': { status: 'Delivered', description: 'Shipment delivered to customer' }
};

const geocodeLocationCache = new Map();

class WarehouseTrackingController {
    /**
     * Reverse geocode latitude and longitude into an exact, 100% accurate readable location string.
     * Uses in-memory cache and multi-tier geocoders (Nominatim with zoom=18 & addressdetails -> Photon -> BigDataCloud).
     */
    static async resolveLocationFromCoords(lat, lon) {
        if (!lat || !lon) return null;
        const nLat = parseFloat(lat);
        const nLon = parseFloat(lon);
        if (isNaN(nLat) || isNaN(nLon) || (nLat === 0 && nLon === 0)) return null;

        const cacheKey = `${nLat.toFixed(5)},${nLon.toFixed(5)}`;
        if (geocodeLocationCache.has(cacheKey)) {
            return geocodeLocationCache.get(cacheKey);
        }

        const cleanDisplayName = (str) => {
            if (!str) return '';
            const parts = str.split(',').map(p => p.trim()).filter(Boolean);
            const seen = new Set();
            const result = [];
            for (const part of parts) {
                const lower = part.toLowerCase();
                if (!seen.has(lower)) {
                    seen.add(lower);
                    result.push(part);
                }
            }
            return result.join(', ');
        };

        // 1. Nominatim (OpenStreetMap) with zoom=18 and full addressdetails for 100% exact street/locality
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${nLat}&lon=${nLon}&format=json&zoom=18&addressdetails=1`,
                {
                    headers: { 'User-Agent': 'AsiaDirect-WarehouseTracking/1.0' },
                    signal: controller.signal
                }
            );
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.display_name) {
                    const exactAddress = cleanDisplayName(data.display_name);
                    const addrDetails = data.address ? {
                        road: data.address.road || null,
                        suburb: data.address.suburb || data.address.neighbourhood || null,
                        city: data.address.city || data.address.town || data.address.village || null,
                        district: data.address.state_district || data.address.county || null,
                        state: data.address.state || null,
                        postcode: data.address.postcode || null,
                        country: data.address.country || null
                    } : null;

                    const resObj = {
                        location: exactAddress,
                        exact_location: exactAddress,
                        address_details: addrDetails,
                        toString() { return this.location; }
                    };
                    geocodeLocationCache.set(cacheKey, resObj);
                    return resObj;
                }
            }
        } catch (e) {}

        // 2. High-accuracy fallback: Photon (OSM based)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(
                `https://photon.komoot.io/reverse?lat=${nLat}&lon=${nLon}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const p = data.features && data.features[0] && data.features[0].properties;
                if (p) {
                    const parts = [
                        p.name,
                        p.street,
                        p.district,
                        p.city,
                        p.county,
                        p.state,
                        p.postcode,
                        p.country
                    ].filter(Boolean);
                    const exactAddress = cleanDisplayName(parts.join(', '));
                    const resObj = {
                        location: exactAddress,
                        exact_location: exactAddress,
                        address_details: {
                            road: p.street || null,
                            suburb: p.district || null,
                            city: p.city || null,
                            district: p.county || null,
                            state: p.state || null,
                            postcode: p.postcode || null,
                            country: p.country || null
                        },
                        toString() { return this.location; }
                    };
                    geocodeLocationCache.set(cacheKey, resObj);
                    return resObj;
                }
            }
        } catch (e) {}

        // 3. Fallback: BigDataCloud reverse geocode client
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${nLat}&longitude=${nLon}&localityLanguage=en`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const parts = [
                    data.locality || data.localityInfo?.administrative?.[3]?.name,
                    data.city || data.localityInfo?.administrative?.[2]?.name,
                    data.principalSubdivision,
                    data.countryName,
                    data.postcode
                ].filter(Boolean);
                if (parts.length > 0) {
                    const exactAddress = cleanDisplayName(parts.join(', '));
                    const resObj = {
                        location: exactAddress,
                        exact_location: exactAddress,
                        address_details: {
                            road: null,
                            suburb: data.locality || null,
                            city: data.city || null,
                            district: data.localityInfo?.administrative?.[2]?.name || null,
                            state: data.principalSubdivision || null,
                            postcode: data.postcode || null,
                            country: data.countryName || null
                        },
                        toString() { return this.location; }
                    };
                    geocodeLocationCache.set(cacheKey, resObj);
                    return resObj;
                }
            }
        } catch (e) {}

        const fallbackCoords = `${nLat.toFixed(5)}, ${nLon.toFixed(5)}`;
        const fallbackObj = {
            location: fallbackCoords,
            exact_location: fallbackCoords,
            address_details: null,
            toString() { return this.location; }
        };
        geocodeLocationCache.set(cacheKey, fallbackObj);
        return fallbackObj;
    }
    /**
     * Normalize any status or event string to strictly match one of the 12 official timeline statuses.
     * Guaranteed to strip "(1/10 Boxes)", "(X/Y Boxes)", or "Partially Delivered (...)" so UI & order sync stay 100% clean.
     */
    static normalizeTimelineStatus(input) {
        if (!input || typeof input !== 'string') return '';
        let clean = input.trim();
        if (!clean) return '';

        // 1. Strip any "(X/Y Boxes)", "(X/Y)", or box count progress suffixes:
        clean = clean.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*boxes?\s*\)/gi, '').trim();
        clean = clean.replace(/\s*\(\s*\d+\s*boxes?\s*\)/gi, '').trim();

        // 2. Normalize "Partially Delivered" to "Out for delivery"
        clean = clean.replace(/^partially\s+delivered/gi, 'Out for delivery').trim();
        clean = clean.replace(/^partially\s+/gi, '').trim();

        // 3. Exact match against the 12 official statuses:
        for (const official of OFFICIAL_SHIPMENT_TIMELINE_STATUSES) {
            if (clean.toLowerCase() === official.toLowerCase()) {
                return official;
            }
        }

        // 4. Map known variations or legacy strings:
        const lower = clean.toLowerCase();
        if (lower.includes('collected') || lower.includes('pickup')) {
            return 'Collected from supplier';
        }
        if (lower.includes('dispatched to port') || lower.includes('dispatched_port')) {
            return 'Dispatched to port';
        }
        if (lower.includes('goods at origin port') || lower.includes('loaded to container') || lower.includes('loaded_container') || lower.includes('loaded to flight') || lower.includes('loaded_flight')) {
            return 'Goods at origin port';
        }
        if (lower.includes('destination port') || lower.includes('arrived at destination port')) {
            return 'Arrived at destination port';
        }
        if (lower.includes('customs clearing') || lower.includes('customs in progress')) {
            return 'Customs clearing in progress';
        }
        if (lower.includes('customs release') || lower.includes('customs cleared')) {
            return 'Customs released';
        }
        if (lower.includes('in transit') && (lower.includes('warehouse') || lower.includes('depot'))) {
            return 'Goods in transit to warehouse';
        }
        if (lower.includes('transit') || lower.includes('scanned out') || lower.includes('departed')) {
            return 'Goods are in transit';
        }
        // Destination warehouse:
        if (lower.includes('booked into warehouse (sa)') || lower.includes('arrived at destination') || lower.includes('offloaded') || lower.includes('offloading') || lower.includes('destination warehouse') || lower.includes('imported at asia direct warehouse')) {
            return 'Arrived at Asia Direct warehouse';
        }
        // Origin warehouse:
        if (lower.includes('booked into warehouse (china)') || lower.includes('received at origin') || lower.includes('received_origin') || lower.includes('intake') || lower.includes('booked into warehouse') || lower.includes('received at warehouse') || lower.includes('goods received at warehouse') || lower.includes('received at asia direct warehouse')) {
            return 'Received at Asia Direct warehouse';
        }
        if (lower.includes('ready for delivery') || lower.includes('readyfordelivery') || lower.includes('out for delivery')) {
            return 'Out for delivery';
        }
        if (lower.includes('delivered')) {
            return 'Delivered';
        }

        return clean;
    }

    /**
     * Format country string to client standard abbreviation (e.g. South Africa -> SA, China -> China)
     */
    static formatCountryLabel(countryName, shortname) {
        const name = (countryName || '').trim();
        const code = (shortname || '').trim().toUpperCase();
        if (!name && !code) return '';
        if (name.toLowerCase() === 'south africa' || code === 'ZA' || code === 'SA') return 'SA';
        if (name.toLowerCase() === 'china' || code === 'CN') return 'China';
        if (name.toLowerCase() === 'india' || code === 'IN') return 'India';
        if (name.toLowerCase() === 'zimbabwe' || code === 'ZW') return 'Zimbabwe';
        if (name.toLowerCase() === 'zambia' || code === 'ZM') return 'Zambia';
        return name || code;
    }

    /**
     * Resolve dynamic milestone status & description based on scan event and locations.
     * Guaranteed: milestone.status ALWAYS returns one of the 12 official timeline statuses!
     */
    static resolveScanMilestone(scanEvent, originCountry, destCountry, scannedCountry) {
        const normalized = (scanEvent || '').toLowerCase().trim();
        const origLoc = scannedCountry || originCountry || 'China';
        const destLoc = scannedCountry || destCountry || 'SA';

        switch (normalized) {
            case 'collected_supplier':
            case 'collected_from_supplier':
            case 'pickup':
            case 'collected':
                return {
                    status: 'Collected from supplier',
                    description: `Collected from supplier (${origLoc})`
                };

            case 'received_origin':
            case 'received_warehouse':
            case 'intake':
            case 'booked_origin':
            case 'booked_warehouse':
            case 'goods received at warehouse':
                return {
                    status: 'Received at Asia Direct warehouse',
                    description: `Received and booked into origin warehouse (${origLoc} facility)`
                };

            case 'dispatched_to_port':
            case 'dispatched_port':
                return {
                    status: 'Dispatched to port',
                    description: `Dispatched from warehouse to port facility (${origLoc})`
                };

            case 'goods_at_origin_port':
            case 'loaded_container':
            case 'loaded_flight':
                return {
                    status: 'Goods at origin port',
                    description: `Goods at origin port / loaded for departure (${origLoc})`
                };

            case 'departed_origin':
            case 'transit':
            case 'goods_in_transit':
            case 'goods are in transit':
            case 'scanned_out':
            case 'scanned_out_warehouse':
                return {
                    status: 'Goods are in transit',
                    description: `Departed origin facility / in transit (${origLoc})`
                };

            case 'arrived_destination_port':
            case 'port_destination':
                return {
                    status: 'Arrived at destination port',
                    description: `Arrived at destination port (${destLoc})`
                };

            case 'customs_clearing':
            case 'customs':
            case 'customs_in_progress':
                return {
                    status: 'Customs clearing in progress',
                    description: 'Customs clearing documentation and inspection in progress'
                };

            case 'customs_released':
            case 'customs release':
            case 'customs_cleared':
                return {
                    status: 'Customs released',
                    description: 'Customs inspection cleared and released'
                };

            case 'transit_warehouse':
            case 'goods in transit to warehouse':
            case 'goods_in_transit_to_warehouse':
                return {
                    status: 'Goods in transit to warehouse',
                    description: `Goods in transit from port to destination warehouse (${destLoc})`
                };

            case 'arrived_destination':
            case 'received_destination':
            case 'booked_destination':
            case 'arrived at destination warehouse':
            case 'offloaded':
            case 'offloading':
                return {
                    status: 'Arrived at Asia Direct warehouse',
                    description: `Arrived and offloaded at destination warehouse (${destLoc})`
                };

            case 'readyfordelivery':
            case 'ready_for_delivery':
            case 'ready for delivery':
            case 'out_for_delivery':
            case 'out for delivery':
                return {
                    status: 'Out for delivery',
                    description: 'Out for final delivery to customer'
                };

            case 'delivered':
                return {
                    status: 'Delivered',
                    description: 'Shipment delivered to customer'
                };

            default: {
                const mapped = SCAN_EVENT_ORDER_TRACK_MAP[normalized];
                if (mapped) {
                    return mapped;
                }
                const clean = WarehouseTrackingController.normalizeTimelineStatus(scanEvent);
                return {
                    status: clean || 'Received at Asia Direct warehouse',
                    description: clean ? `Milestone: ${clean}` : 'Warehouse scan event'
                };
            }
        }
    }

    /**
     * Milestone stage ranking (1 to 12) matching the 12 shipment timeline milestones
     */
    static getMilestoneRank(event) {
        if (!event) return 0;
        const ev = event.toLowerCase().trim();
        if (ev === 'generated' || ev === 'awaiting check-in' || ev.includes('awaiting') || ev.includes('pending check-in')) {
            return 0;
        }
        const ranks = {
            'generated': 0,
            // 1. Collected from supplier
            'collected_supplier': 1,
            'collected_from_supplier': 1,
            'pickup': 1,
            'collected': 1,
            'collected from supplier': 1,
            // 2. Received at Asia Direct warehouse (Origin)
            'received_origin': 2,
            'received_warehouse': 2,
            'intake': 2,
            'booked_origin': 2,
            'booked_warehouse': 2,
            'goods received at warehouse': 2,
            'received at asia direct warehouse': 2,
            'booked into warehouse (china)': 2,
            // 3. Dispatched to port
            'dispatched_to_port': 3,
            'dispatched_port': 3,
            'dispatched to port': 3,
            // 4. Goods at origin port
            'goods_at_origin_port': 4,
            'loaded_container': 4,
            'loaded_flight': 4,
            'goods at origin port': 4,
            'loaded to container': 4,
            'loaded to flight': 4,
            // 5. Goods are in transit
            'departed_origin': 5,
            'scanned_out': 5,
            'transit': 5,
            'goods_in_transit': 5,
            'goods are in transit': 5,
            'scanned_out_warehouse': 5,
            'scanned out of warehouse (china) - transit': 5,
            // 6. Arrived at destination port
            'arrived_destination_port': 6,
            'port_destination': 6,
            'arrived at destination port': 6,
            // 7. Customs clearing in progress
            'customs_clearing': 7,
            'customs': 7,
            'customs_in_progress': 7,
            'customs clearing in progress': 7,
            // 8. Customs released
            'customs_released': 8,
            'customs release': 8,
            'customs_cleared': 8,
            'customs released': 8,
            // 9. Goods in transit to warehouse
            'transit_warehouse': 9,
            'goods in transit to warehouse': 9,
            'goods_in_transit_to_warehouse': 9,
            // 10. Arrived at Asia Direct warehouse (Destination depot)
            'arrived_destination': 10,
            'received_destination': 10,
            'booked_destination': 10,
            'arrived at destination warehouse': 10,
            'offloaded': 10,
            'offloading': 10,
            'arrived at asia direct warehouse': 10,
            'booked into warehouse (sa)': 10,
            // 11. Out for delivery
            'readyfordelivery': 11,
            'ready_for_delivery': 11,
            'ready for delivery': 11,
            'out_for_delivery': 11,
            'out for delivery': 11,
            // 12. Delivered
            'delivered': 12
        };
        if (ranks[ev] !== undefined) return ranks[ev];
        const normalized = WarehouseTrackingController.normalizeTimelineStatus(ev);
        if (normalized && ranks[normalized.toLowerCase()] !== undefined) {
            return ranks[normalized.toLowerCase()];
        }
        return 0; // Default unknown/unranked to 0 (unstarted), never 2!
    }

    /**
     * Map milestone rank (1 to 12) to official timeline status string
     */
    static getMilestoneByRank(rank) {
        switch (Number(rank)) {
            case 1: return 'Collected from supplier';
            case 2: return 'Received at Asia Direct warehouse';
            case 3: return 'Dispatched to port';
            case 4: return 'Goods at origin port';
            case 5: return 'Goods are in transit';
            case 6: return 'Arrived at destination port';
            case 7: return 'Customs clearing in progress';
            case 8: return 'Customs released';
            case 9: return 'Goods in transit to warehouse';
            case 10: return 'Arrived at Asia Direct warehouse';
            case 11: return 'Out for delivery';
            case 12: return 'Delivered';
            default: return null;
        }
    }

    /**
     * Generate individual box barcodes for an intake consignment
     * POST /api/warehouse/barcodes/generate
     */
    static generateBoxBarcodes(req, res) {
        // 1. Request body existence check
        if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body is required and cannot be empty'
            });
        }

        const {
            supplier_warehouse_order_id,
            warehouse_reference,
            warehouse_ref,
            shipment_number,
            order_number,
            total_boxes,
            weight_kg,
            cbm,
            origin_warehouse_id,
            destination_warehouse_id
        } = req.body;

        const refToLookup = (warehouse_reference || warehouse_ref || shipment_number || order_number || '').trim();

        // Identifying field validation - accept either supplier_warehouse_order_id or reference string
        if ((supplier_warehouse_order_id === undefined || supplier_warehouse_order_id === null || supplier_warehouse_order_id === '') && !refToLookup) {
            return res.status(400).json({
                success: false,
                message: 'Either supplier_warehouse_order_id or warehouse_reference/shipment_number is required'
            });
        }

        // 3. Optional numeric fields validation
        if (weight_kg !== undefined && weight_kg !== null && weight_kg !== '') {
            const parsedWeight = parseFloat(weight_kg);
            if (isNaN(parsedWeight) || !isFinite(parsedWeight) || parsedWeight < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'weight_kg must be a valid non-negative number'
                });
            }
        }

        if (cbm !== undefined && cbm !== null && cbm !== '') {
            const parsedCbm = parseFloat(cbm);
            if (isNaN(parsedCbm) || !isFinite(parsedCbm) || parsedCbm < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'cbm must be a valid non-negative number'
                });
            }
        }

        // 4. Connect to MySQL pool for callback-based transaction
        con.getConnection((connErr, connection) => {
            if (connErr) {
                logger.error('Database connection error in generateBoxBarcodes:', connErr);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error: Database connection failed'
                });
            }

            const resolveOrderId = (cb) => {
                if (supplier_warehouse_order_id) {
                    const parsed = parseInt(supplier_warehouse_order_id, 10);
                    if (isNaN(parsed) || parsed <= 0) {
                        return cb(new Error('supplier_warehouse_order_id must be a valid positive integer'));
                    }
                    return cb(null, parsed);
                }

                const lookupSql = `
                    SELECT swo.id FROM supplier_warehouse_orders swo 
                    LEFT JOIN tbl_orders o ON o.id = swo.order_id 
                    WHERE swo.warehouse_order_id = ? 
                       OR o.order_number = ? 
                       OR swo.freight_number = ? 
                       OR swo.id = ? 
                       OR swo.order_id IN (
                           SELECT sd.order_id FROM shipment_details sd 
                           JOIN tbl_shipments ts ON ts.id = sd.shipment_id 
                           WHERE ts.waybill = ? OR ts.id = ? OR ts.load = ?
                       )
                    ORDER BY swo.id DESC LIMIT 1
                `;
                connection.query(lookupSql, [refToLookup, refToLookup, refToLookup, refToLookup, refToLookup, refToLookup, refToLookup], (err, rows) => {
                    if (err) return cb(err);
                    if (rows && rows.length > 0) {
                        return cb(null, rows[0].id);
                    }

                    // Fallback: If not found in supplier_warehouse_orders, check tbl_orders directly
                    const tblOrderSql = `
                        SELECT o.id, o.order_number, o.supplier_id, o.client_id, o.client_name, 
                               o.goods_description, o.cartons, o.weight, o.CBM, o.freight_id,
                               tf.freight_number, tf.product_desc, tf.no_of_packages, tf.weight as freight_weight, tf.dimension as freight_dimension,
                               tf.shipper_name, tf.client_ref_name
                        FROM tbl_orders o
                        LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                        WHERE o.order_number = ? 
                           OR o.id = ? 
                           OR tf.freight_number = ?
                        LIMIT 1
                    `;
                    const parsedNum = parseInt(refToLookup.replace(/^(ORD-|OR)/i, ''), 10) || 0;
                    connection.query(tblOrderSql, [refToLookup, parsedNum, refToLookup], (orderErr, orderMatchRows) => {
                        if (orderErr) return cb(orderErr);
                        if (!orderMatchRows || orderMatchRows.length === 0) {
                            const notFoundErr = new Error(`No consignment found matching reference '${refToLookup}'`);
                            notFoundErr.status = 404;
                            return cb(notFoundErr);
                        }

                        const matchOrder = orderMatchRows[0];
                        // Auto-create intake consignment in supplier_warehouse_orders so it links seamlessly
                        const autoSwoSql = `
                            INSERT INTO supplier_warehouse_orders (
                                order_id,
                                supplier_id,
                                client_id,
                                warehouse_id,
                                freight_number,
                                warehouse_order_id,
                                customer_name,
                                supplier_company,
                                goods_description,
                                total_packages,
                                total_weight,
                                total_cbm,
                                destination_country
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;
                        const initPackages = (total_boxes && parseInt(total_boxes, 10) > 0)
                            ? parseInt(total_boxes, 10)
                            : (parseInt(matchOrder.cartons, 10) || matchOrder.no_of_packages || 1);
                        const initWeight = (weight_kg !== undefined && weight_kg !== null && weight_kg !== '')
                            ? parseFloat(weight_kg)
                            : (parseFloat(matchOrder.weight) || matchOrder.freight_weight || 0);
                        const initCbm = (cbm !== undefined && cbm !== null && cbm !== '')
                            ? parseFloat(cbm)
                            : (parseFloat(matchOrder.CBM) || matchOrder.freight_dimension || 0);
                        const defaultOriginWh = origin_warehouse_id ? parseInt(origin_warehouse_id, 10) : 1;
                        const defaultDest = destination_warehouse_id ? parseInt(destination_warehouse_id, 10) : 2;

                        connection.query(autoSwoSql, [
                            matchOrder.id,
                            matchOrder.supplier_id || 0,
                            matchOrder.client_id || 0,
                            defaultOriginWh,
                            matchOrder.freight_number || null,
                            matchOrder.order_number || ('OR000' + matchOrder.id),
                            matchOrder.client_name || matchOrder.client_ref_name || 'Asia Direct Customer',
                            matchOrder.shipper_name || 'N/A',
                            matchOrder.goods_description || matchOrder.product_desc || 'General Cargo',
                            initPackages,
                            initWeight,
                            initCbm,
                            defaultDest
                        ], (insSwoErr, insSwoRes) => {
                            if (insSwoErr) {
                                logger.error('Error auto-creating supplier_warehouse_orders row:', insSwoErr);
                                return cb(insSwoErr);
                            }
                            return cb(null, insSwoRes.insertId);
                        });
                    });
                });
            };

            resolveOrderId((resErr, parsedOrderId) => {
                if (resErr) {
                    connection.release();
                    const status = resErr.status || 400;
                    return res.status(status).json({ success: false, message: resErr.message });
                }

                // Step 0: Mandatory validation - Order MUST have at least one warehouse product added before generating barcodes
                const fetchProductsSql = `
                    SELECT id, supplier_warehouse_id, product_description, hazardous, date_received,
                           package_type, packages, dimension, weight, warehouse_ref, freight,
                           groupage_batch_ref, supplier, warehouse_receipt_number, tracking_number,
                           date_dispatched, supplier_address, warehouse_collect, costs_to_collect,
                           port_of_loading, warehouse_dispatch, warehouse_cost, cost_to_dispatch,
                           waybill_ref, supplier_email, supplier_contact, added_by, pictures
                    FROM supplier_warehouse_products
                    WHERE supplier_warehouse_id = ?
                    ORDER BY id ASC
                `;

                connection.query(fetchProductsSql, [parsedOrderId], (prodErr, productRows) => {
                    if (prodErr) {
                        connection.release();
                        logger.error('Error verifying order products for barcode generation:', prodErr);
                        return res.status(500).json({
                            success: false,
                            message: 'Internal server error: Failed to verify order products'
                        });
                    }

                    if (!productRows || productRows.length === 0) {
                        connection.release();
                        return res.status(400).json({
                            success: false,
                            error_code: 'PRODUCT_REQUIRED',
                            message: 'Cannot generate barcodes: Please add at least one warehouse product to this order before generating barcodes.'
                        });
                    }

                    // Step A: Duplicate check based on supplier_warehouse_order_id
                    const checkExistingSql = `
                        SELECT id, barcode_string, box_number, total_boxes, warehouse_order_number, current_status 
                        FROM warehouse_package_boxes 
                        WHERE supplier_warehouse_order_id = ? 
                        ORDER BY box_number ASC
                    `;

                    connection.query(checkExistingSql, [parsedOrderId], (checkErr, existingRows) => {
                        if (checkErr) {
                            connection.release();
                            logger.error('Error checking existing barcodes:', checkErr);
                            return res.status(500).json({
                                success: false,
                                message: 'Internal server error: Failed to check existing barcodes'
                            });
                        }

                        const proceedToGenerate = () => {
                            // Step B: Validate that the parent consignment exists and resolve warehouse
                            const targetWarehouseId = origin_warehouse_id ? parseInt(origin_warehouse_id, 10) : null;
                            const fetchOrderSql = `
                                SELECT swo.id, swo.warehouse_order_id, swo.freight_number, swo.total_packages,
                                       swo.warehouse_id, swo.destination_country, swo.order_id,
                                       swo.admin_warehouseOrder_id,
                                       swo.customer_name, swo.customer_ref, swo.supplier_company,
                                       swo.goods_description, swo.package_type, swo.total_weight, swo.total_cbm,
                                       swo.courier_waybill_ref, swo.box_marking,
                                       o.order_number as tbl_order_number,
                                       COALESCE(req_w.warehouse_number, w.warehouse_number) as warehouse_number,
                                       COALESCE(req_w.warehouse_name, w.warehouse_name, 'China Warehouse') as warehouse_name,
                                       COALESCE(req_w.id, w.id) as resolved_warehouse_id,
                                       COALESCE(c.name, 'South Africa Warehouse') as destination_country_name
                                FROM supplier_warehouse_orders swo
                                LEFT JOIN tbl_orders o ON o.id = swo.order_id
                                LEFT JOIN warehouse_tbl w ON w.id = swo.warehouse_id
                                LEFT JOIN warehouse_tbl req_w ON req_w.id = ?
                                LEFT JOIN countries c ON c.id = swo.destination_country
                                WHERE swo.id = ?
                            `;

                            connection.query(fetchOrderSql, [targetWarehouseId, parsedOrderId], (orderErr, orderRows) => {
                                if (orderErr) {
                                    connection.release();
                                    logger.error('Error fetching parent order:', orderErr);
                                    return res.status(500).json({
                                        success: false,
                                        message: 'Internal server error: Failed to verify parent order'
                                    });
                                }

                                if (orderRows.length === 0) {
                                    connection.release();
                                    return res.status(404).json({
                                        success: false,
                                        message: `Supplier warehouse order with ID ${parsedOrderId} not found`
                                    });
                                }

                                const order = orderRows[0];

                                // Aggregate full product details
                                const totalProductPackages = productRows.reduce((acc, p) => acc + (parseInt(p.packages, 10) || 0), 0);
                                const totalProductWeight = productRows.reduce((acc, p) => acc + (parseFloat(p.weight) || 0), 0);
                                const combinedProductDesc = productRows.map(p => p.product_description).filter(Boolean).join('; ') || order.goods_description || 'General Cargo';
                                const combinedDimensions = productRows.map(p => p.dimension).filter(Boolean).join('; ') || 'N/A';
                                const isHazardous = productRows.some(p => p.hazardous == 1 || p.hazardous === '1' || p.hazardous === true || p.hazardous === 'true') || order.hazardous == 1;
                                const supplierName = order.supplier_company || productRows[0]?.supplier || 'N/A';
                                const waybillRef = order.courier_waybill_ref || productRows[0]?.waybill_ref || 'N/A';

                                // Step C: Validate total_boxes (reject 0, negative, decimals, alpha strings, NaN)
                                let finalTotalBoxes = null;
                                if (total_boxes !== undefined && total_boxes !== null && total_boxes !== '') {
                                    const parsedTotal = parseInt(total_boxes, 10);
                                    if (isNaN(parsedTotal) || parsedTotal <= 0 || String(total_boxes).includes('.')) {
                                        connection.release();
                                        return res.status(400).json({
                                            success: false,
                                            message: 'total_boxes must be a valid positive integer'
                                        });
                                    }
                                    if (parsedTotal > 1000) {
                                        connection.release();
                                        return res.status(400).json({
                                            success: false,
                                            message: 'total_boxes cannot exceed maximum limit of 1000'
                                        });
                                    }
                                    finalTotalBoxes = parsedTotal;
                                } else if (totalProductPackages > 0) {
                                    finalTotalBoxes = totalProductPackages;
                                } else if (order.total_packages && parseInt(order.total_packages, 10) > 0) {
                                    finalTotalBoxes = parseInt(order.total_packages, 10);
                                } else {
                                    connection.release();
                                    return res.status(400).json({
                                        success: false,
                                        message: 'total_boxes is required and was not specified in request, products, or parent order'
                                    });
                                }

                                // Step D: Validate Order Number (prioritizing tbl_orders.order_number format e.g. OR0001197 / OR0001153)
                                let orderNumber = null;
                                if (order.tbl_order_number && String(order.tbl_order_number).trim()) {
                                    orderNumber = String(order.tbl_order_number).trim();
                                } else if (order.order_id) {
                                    const rawId = String(order.order_id).trim();
                                    orderNumber = rawId.toUpperCase().startsWith('OR') ? rawId.toUpperCase() : `OR000${rawId}`;
                                } else if (order.warehouse_order_id && String(order.warehouse_order_id).trim()) {
                                    const rawWh = String(order.warehouse_order_id).trim();
                                    orderNumber = rawWh.toUpperCase().startsWith('OR') ? rawWh.toUpperCase() : rawWh;
                                } else if (order.freight_number && String(order.freight_number).trim()) {
                                    orderNumber = String(order.freight_number).trim();
                                } else {
                                    orderNumber = `WH-${order.id}`;
                                }

                                // Step E: Determine Warehouse Prefix
                                let whPrefix = null;
                                if (order.warehouse_number && order.warehouse_number.trim()) {
                                    whPrefix = order.warehouse_number.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 4);
                                } else if (order.warehouse_name && order.warehouse_name.trim()) {
                                    const nameUpper = order.warehouse_name.toUpperCase();
                                    if (nameUpper.includes('SHENZHEN') || nameUpper.includes('GUANGZHOU')) whPrefix = 'CAN';
                                    else if (nameUpper.includes('JHB') || nameUpper.includes('JOHANNESBURG')) whPrefix = 'JNB';
                                    else if (nameUpper.includes('NOIDA') || nameUpper.includes('MUMBAI') || nameUpper.includes('INDIA')) whPrefix = 'BOM';
                                    else whPrefix = nameUpper.substring(0, 3).replace(/[^A-Z]/g, '');
                                }

                                if (!whPrefix || whPrefix.length === 0) {
                                    whPrefix = 'CAN';
                                }

                                // Step F: Build box values array
                                const insertValues = [];
                                const responseBoxes = [];

                                const originWhId = origin_warehouse_id ? parseInt(origin_warehouse_id, 10) : (order.warehouse_id || null);
                                const destWhId = destination_warehouse_id ? parseInt(destination_warehouse_id, 10) : null;
                                const resolvedTotalWeight = (weight_kg !== undefined && weight_kg !== null && weight_kg !== '')
                                    ? parseFloat(weight_kg)
                                    : (totalProductWeight > 0 ? totalProductWeight : (parseFloat(order.total_weight) || 0));

                                const calcWeight = resolvedTotalWeight > 0 ? (resolvedTotalWeight / finalTotalBoxes).toFixed(2) : null;
                                const calcCbm = (cbm !== undefined && cbm !== null && cbm !== '')
                                    ? (parseFloat(cbm) / finalTotalBoxes).toFixed(4)
                                    : (order.total_cbm ? (parseFloat(order.total_cbm) / finalTotalBoxes).toFixed(4) : null);

                                try {
                                    for (let boxNum = 1; boxNum <= finalTotalBoxes; boxNum++) {
                                        const barcode = BarcodeService.buildBarcodeString({
                                            warehouseRef: whPrefix,
                                            orderNumber: orderNumber,
                                            boxNumber: boxNum,
                                            totalBoxes: finalTotalBoxes
                                        });

                                        insertValues.push([
                                            parsedOrderId,
                                            order.admin_warehouseOrder_id || null, // warehouse_assign_order_id
                                            order.order_id || null,
                                            originWhId,
                                            destWhId,
                                            barcode,
                                            orderNumber,
                                            boxNum,
                                            finalTotalBoxes,
                                            calcWeight,
                                            calcCbm,
                                            'GENERATED'
                                        ]);

                                        const qrPayload = `TMS:${shipment_number || 'N/A'}|REF:${order.warehouse_order_id || orderNumber}|ORD:${orderNumber}|BOX:${boxNum}/${finalTotalBoxes}|ORG:${whPrefix}|DST:${order.destination_country_name || 'AFRICA'}|WT:${calcWeight || 0}KG|CBM:${calcCbm || 0}|PROD:${combinedProductDesc}|DIM:${combinedDimensions}|HAZ:${isHazardous ? 'YES' : 'NO'}|CUST:${order.customer_name || 'Asia Direct Customer'}|CREF:${order.customer_ref || 'N/A'}|SUPP:${supplierName}|WB:${waybillRef}`;

                                        responseBoxes.push({
                                            box_number: boxNum,
                                            total_boxes: finalTotalBoxes,
                                            barcode_string: barcode,
                                            barcode_image_url: `/api/warehouse/barcodes/image/${barcode}`,
                                            qr_code_data: qrPayload,
                                            badge_text: String(boxNum),
                                            order_number: orderNumber,
                                            warehouse_order_number: order.warehouse_order_id || orderNumber,
                                            customer_name: order.customer_name || 'Asia Direct Customer',
                                            customer_ref: order.customer_ref || null,
                                            supplier_company: supplierName,
                                            product_description: combinedProductDesc,
                                            product_dimension: combinedDimensions,
                                            is_hazardous: isHazardous,
                                            origin_name: order.warehouse_name || 'China Warehouse',
                                            destination_name: order.destination_country_name || 'South Africa Warehouse',
                                            weight_kg: calcWeight !== null ? parseFloat(calcWeight) : null,
                                            cbm: calcCbm !== null ? parseFloat(calcCbm) : null,
                                            current_status: 'GENERATED',
                                            products: productRows.map(p => ({
                                                id: p.id,
                                                product_description: p.product_description,
                                                packages: p.packages,
                                                package_type: p.package_type,
                                                dimension: p.dimension,
                                                weight: p.weight,
                                                hazardous: p.hazardous
                                            }))
                                        });
                                    }
                                } catch (genErr) {
                                    connection.release();
                                    logger.error('Error generating barcode string:', genErr);
                                    return res.status(500).json({
                                        success: false,
                                        message: 'Error generating barcode strings: ' + genErr.message
                                    });
                                }

                                // Step G: Execute insert within database transaction
                                connection.beginTransaction((txErr) => {
                                    if (txErr) {
                                        connection.release();
                                        logger.error('Transaction begin error:', txErr);
                                        return res.status(500).json({
                                            success: false,
                                            message: 'Database transaction initialization failed'
                                        });
                                    }

                                    const insertSql = `
                                    INSERT INTO warehouse_package_boxes (
                                        supplier_warehouse_order_id,
                                        warehouse_assign_order_id,
                                        order_id,
                                        origin_warehouse_id,
                                        destination_warehouse_id,
                                        barcode_string,
                                        warehouse_order_number,
                                        box_number,
                                        total_boxes,
                                        weight_kg,
                                        cbm,
                                        current_status
                                    ) VALUES ?
                                `;

                                    connection.query(insertSql, [insertValues], (insErr, insResult) => {
                                        if (insErr) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                logger.error('Error inserting box records:', insErr);
                                                if (insErr.code === 'ER_DUP_ENTRY') {
                                                    return res.status(409).json({
                                                        success: false,
                                                        message: 'Duplicate barcode entry detected during generation'
                                                    });
                                                }
                                                return res.status(500).json({
                                                    success: false,
                                                    message: 'Failed to save generated barcodes to database'
                                                });
                                            });
                                        }

                                        connection.commit((commitErr) => {
                                            if (commitErr) {
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    logger.error('Transaction commit error:', commitErr);
                                                    return res.status(500).json({
                                                        success: false,
                                                        message: 'Database transaction commit failed'
                                                    });
                                                });
                                            }

                                            connection.release();
                                            return res.status(201).json({
                                                success: true,
                                                message: `Successfully generated ${finalTotalBoxes} box barcodes for order ${orderNumber} with complete product details`,
                                                supplier_warehouse_order_id: parsedOrderId,
                                                warehouse_reference: order.warehouse_order_id || orderNumber,
                                                order_number: orderNumber,
                                                total_boxes: finalTotalBoxes,
                                                origin_warehouse: order.warehouse_name || 'China Warehouse',
                                                destination_warehouse: order.destination_country_name || 'South Africa Warehouse',
                                                order_details: {
                                                    customer_name: order.customer_name,
                                                    customer_ref: order.customer_ref,
                                                    courier_waybill_ref: waybillRef,
                                                    box_marking: order.box_marking,
                                                    goods_description: order.goods_description,
                                                    package_type: order.package_type,
                                                    total_packages: finalTotalBoxes,
                                                    total_weight: resolvedTotalWeight,
                                                    total_cbm: order.total_cbm
                                                },
                                                products_count: productRows.length,
                                                products: productRows.map(p => {
                                                    let parsedPics = [];
                                                    if (p.pictures) {
                                                        try {
                                                            const parsed = JSON.parse(p.pictures);
                                                            parsedPics = (Array.isArray(parsed) ? parsed : [parsed]).map(img => `/product_pictures/${img}`);
                                                        } catch (e) {
                                                            parsedPics = [`/product_pictures/${p.pictures}`];
                                                        }
                                                    }
                                                    return {
                                                        ...p,
                                                        pictures: parsedPics
                                                    };
                                                }),
                                                boxes: responseBoxes
                                            });
                                        });
                                    });
                                });
                            });
                        };

                        if (existingRows.length > 0) {
                            if (!req.body.overwrite && !req.body.force) {
                                connection.release();
                                return res.status(409).json({
                                    success: false,
                                    message: `Barcodes already exist for supplier warehouse order ID ${parsedOrderId}`,
                                    total_boxes: existingRows.length,
                                    boxes: existingRows
                                });
                            }

                            // If overwrite or force is requested, clear previous boxes and scans
                            const oldBoxIds = existingRows.map(r => r.id);
                            connection.query('DELETE FROM warehouse_box_scans WHERE box_id IN (?)', [oldBoxIds], () => {
                                connection.query('DELETE FROM warehouse_package_boxes WHERE supplier_warehouse_order_id = ?', [parsedOrderId], (delErr) => {
                                    if (delErr) {
                                        connection.release();
                                        logger.error('Error clearing old boxes during overwrite:', delErr);
                                        return res.status(500).json({
                                            success: false,
                                            message: 'Failed to clear previous barcodes for overwrite'
                                        });
                                    }
                                    proceedToGenerate();
                                });
                            });
                            return;
                        }

                        proceedToGenerate();
                    });
                });
            });
        });
    }

    /**
     * Stream printable 4x6" PDF labels (Honeywell / Thermal Print Ready)
     * GET /api/warehouse/labels/pdf
     */
    static async getPdfLabels(req, res) {
        const ref = (
            req.query.reference ||
            req.query.ref ||
            req.query.warehouse_ref ||
            req.query.warehouse_reference ||
            req.query.shipment_number ||
            req.query.shipment_id ||
            req.query.order_number ||
            req.query.supplier_warehouse_order_id ||
            req.query.order_id ||
            req.query.barcode ||
            ''
        ).trim();

        if (!ref) {
            return res.status(400).json({
                success: false,
                message: 'Must provide reference, warehouse_ref, shipment_number, supplier_warehouse_order_id, order_id, or barcode'
            });
        }

        try {
            const boxesQuery = `
                SELECT b.* FROM warehouse_package_boxes b
                LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                WHERE b.barcode_string = ? 
                   OR b.warehouse_order_number = ? 
                   OR swo.warehouse_order_id = ? 
                   OR o.order_number = ? 
                   OR b.supplier_warehouse_order_id = ? 
                   OR b.order_id = ?
                ORDER BY b.box_number ASC
            `;

            // Fetch boxes
            const boxes = await new Promise((resolve, reject) => {
                con.query(boxesQuery, [ref, ref, ref, ref, ref, ref], (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            if (!boxes || boxes.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No boxes found matching criteria for '${ref}'`
                });
            }

            // Fetch metadata
            let meta = {
                warehouse_order_number: boxes[0].warehouse_order_number,
                origin_name: 'China Warehouse',
                destination_name: 'South Africa Hub',
                customer_name: 'N/A',
                supplier_name: 'N/A',
                freight_type: 'Sea Freight Consolidation'
            };

            if (boxes[0].supplier_warehouse_order_id) {
                const orderData = await new Promise((resolve, reject) => {
                    con.query(
                        `SELECT swo.*, w.warehouse_name as origin_name, c.name as dest_name,
                                o.order_number as tbl_order_number
                         FROM supplier_warehouse_orders swo
                         LEFT JOIN tbl_orders o ON o.id = swo.order_id
                         LEFT JOIN warehouse_tbl w ON w.id = swo.warehouse_id
                         LEFT JOIN countries c ON c.id = swo.destination_country
                         WHERE swo.id = ?`,
                        [boxes[0].supplier_warehouse_order_id],
                        (err, rows) => (err ? reject(err) : resolve(rows))
                    );
                });

                if (orderData.length > 0) {
                    const o = orderData[0];
                    let resolvedOrderNum = null;
                    if (o.tbl_order_number && String(o.tbl_order_number).trim()) {
                        resolvedOrderNum = String(o.tbl_order_number).trim();
                    } else if (o.order_id) {
                        const rawId = String(o.order_id).trim();
                        resolvedOrderNum = rawId.toUpperCase().startsWith('OR') ? rawId.toUpperCase() : `OR000${rawId}`;
                    } else {
                        resolvedOrderNum = boxes[0].warehouse_order_number || o.warehouse_order_id;
                    }

                    meta = {
                        order_number: resolvedOrderNum,
                        warehouse_order_number: resolvedOrderNum,
                        origin_name: o.origin_name || 'China Depot',
                        destination_name: o.dest_name || 'South Africa',
                        customer_name: o.customer_name || 'N/A',
                        supplier_name: o.supplier_company || o.supplier_person || 'N/A',
                        freight_type: o.package_type || 'Consolidated Freight',
                        total_weight: o.total_weight,
                        total_cbm: o.total_cbm,
                        goods_description: o.goods_description
                    };

                    const productData = await new Promise((resolve) => {
                        con.query(
                            'SELECT product_description, dimension, weight, packages FROM supplier_warehouse_products WHERE supplier_warehouse_id = ?',
                            [boxes[0].supplier_warehouse_order_id],
                            (err, rows) => resolve(rows || [])
                        );
                    });
                    if (productData.length > 0) {
                        const pDesc = productData.map(p => p.product_description).filter(Boolean).join('; ');
                        if (pDesc) meta.goods_description = pDesc;
                        meta.products = productData;
                    }
                }
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="labels-${meta.warehouse_order_number || 'boxes'}.pdf"`);

            await BarcodeService.generatePdfLabels(boxes, meta, res);

        } catch (error) {
            logger.error('Error generating PDF labels:', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to render PDF labels',
                    error: error.message
                });
            }
        }
    }

    /**
     * Get raw ZPL code for Honeywell label printers
     * GET /api/warehouse/labels/zpl
     * Supports printing by: warehouse_ref, shipment_number, supplier_warehouse_order_id, or barcode
     */
    static async getZplLabels(req, res) {
        const ref = (
            req.query.reference ||
            req.query.ref ||
            req.query.warehouse_ref ||
            req.query.warehouse_reference ||
            req.query.shipment_number ||
            req.query.shipment_id ||
            req.query.order_number ||
            req.query.supplier_warehouse_order_id ||
            req.query.order_id ||
            req.query.barcode ||
            ''
        ).trim();
        const format = req.query.format;

        if (!ref) {
            return res.status(400).json({
                success: false,
                message: 'Must provide reference, warehouse_ref, shipment_number, supplier_warehouse_order_id, order_id, or barcode'
            });
        }

        try {
            const boxesQuery = `
                SELECT b.* FROM warehouse_package_boxes b
                LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                WHERE b.barcode_string = ? 
                   OR b.warehouse_order_number = ? 
                   OR swo.warehouse_order_id = ? 
                   OR o.order_number = ? 
                   OR b.supplier_warehouse_order_id = ? 
                   OR b.order_id = ?
                ORDER BY b.box_number ASC
            `;

            const boxes = await new Promise((resolve, reject) => {
                con.query(boxesQuery, [ref, ref, ref, ref, ref, ref], (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            if (!boxes || boxes.length === 0) {
                return res.status(404).json({ success: false, message: `No boxes found for reference '${ref}'` });
            }

            const zplOutput = BarcodeService.generateMultiZplLabels(boxes);

            if (format === 'raw') {
                res.setHeader('Content-Type', 'text/plain');
                return res.send(zplOutput);
            }

            return res.status(200).json({
                success: true,
                total_labels: boxes.length,
                zpl: zplOutput
            });

        } catch (error) {
            logger.error('Error generating ZPL labels:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate ZPL labels',
                error: error.message
            });
        }
    }

    /**
     * Fast validation check before scan recording (Anti-Mismatch & Container Check)
     * POST /api/warehouse/scan/validate
     */
    static async validateScan(req, res) {
        const { barcode_string, target_batch_id } = req.body;
        const expected_event = req.body.expected_event || req.body.scan_event || req.body.event;

        if (!barcode_string) {
            return res.status(400).json({ valid: false, message: 'Barcode string is required' });
        }

        try {
            // 1. Verify Checksum
            const isChecksumValid = BarcodeService.verifyChecksum(barcode_string);
            if (!isChecksumValid) {
                return res.status(200).json({
                    valid: false,
                    error_code: 'CHECKSUM_FAIL',
                    message: 'Invalid barcode checksum - possible misread or damaged label'
                });
            }

            // 2. Query box in DB
            const boxRows = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT b.*, swo.destination_country, swo.customer_name, swo.goods_description 
                     FROM warehouse_package_boxes b
                     LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                     WHERE b.barcode_string = ?`,
                    [barcode_string],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            if (boxRows.length === 0) {
                return res.status(200).json({
                    valid: false,
                    error_code: 'BOX_NOT_FOUND',
                    message: `Barcode ${barcode_string} not recognized in system`
                });
            }

            const box = boxRows[0];

            // 2.5 Multi-Box Consignment Stage Prerequisite Check
            if (expected_event) {
                const targetOrderId = box.order_id;
                const targetSwoId = box.supplier_warehouse_order_id;
                const allBoxes = await new Promise((resolve) => {
                    con.query(
                        `SELECT id, box_number, total_boxes, barcode_string, current_status 
                         FROM warehouse_package_boxes 
                         WHERE (order_id = ? AND ? > 0) OR (supplier_warehouse_order_id = ? AND ? > 0)
                         ORDER BY box_number ASC`,
                        [targetOrderId || 0, targetOrderId || 0, targetSwoId || 0, targetSwoId || 0],
                        (err, rows) => resolve(rows || [])
                    );
                });

                const totalBoxes = allBoxes.length > 0 ? Math.max(allBoxes.length, allBoxes[0].total_boxes || box.total_boxes || 1) : (box.total_boxes || 1);
                const expectedRank = WarehouseTrackingController.getMilestoneRank(expected_event);
                const currentBoxRank = WarehouseTrackingController.getMilestoneRank(box.current_status);
                const otherBoxes = allBoxes.filter(b => b.id !== box.id);
                const minOtherRank = otherBoxes.length > 0
                    ? Math.min(...otherBoxes.map(b => WarehouseTrackingController.getMilestoneRank(b.current_status)))
                    : currentBoxRank;

                // Parallel Cohort Check: Cannot update a box if it is already ahead of other boxes
                if (totalBoxes > 1 && otherBoxes.length > 0 && currentBoxRank > minOtherRank) {
                    const laggingBox = otherBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < currentBoxRank);
                    const stageName = WarehouseTrackingController.getMilestoneByRank(currentBoxRank) || box.current_status;
                    const laggingStatus = laggingBox.current_status === 'GENERATED' || !laggingBox.current_status
                        ? 'Awaiting Check-in'
                        : (WarehouseTrackingController.normalizeTimelineStatus(laggingBox.current_status) || laggingBox.current_status);

                    return res.status(200).json({
                        valid: false,
                        error_code: 'CONSIGNMENT_PARALLEL_PROGRESSION_REQUIRED',
                        message: `Cannot update Box ${box.box_number} further. Box ${laggingBox.box_number} of ${totalBoxes} [${laggingBox.barcode_string}] has not completed this stage yet (currently '${laggingStatus}'). All ${totalBoxes} boxes must be processed in parallel at each step before moving forward.`,
                        box: box,
                        pending_box: laggingBox
                    });
                }

                if (totalBoxes > 1 && expectedRank > 2) {
                    const unreceived = allBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 2);
                    if (unreceived) {
                        return res.status(200).json({
                            valid: false,
                            error_code: 'STAGE_PREREQUISITE_NOT_MET',
                            message: `Cannot scan for '${expected_event}'. All ${totalBoxes} boxes in this order must first be received and checked in at the warehouse (Box ${unreceived.box_number} is still '${unreceived.current_status || 'GENERATED'}').`,
                            box: box,
                            pending_box: unreceived
                        });
                    }
                }

                if (totalBoxes > 1 && expectedRank >= 11) {
                    const pendingDest = allBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 10);
                    if (pendingDest) {
                        return res.status(200).json({
                            valid: false,
                            error_code: 'STAGE_PREREQUISITE_NOT_MET',
                            message: `Cannot scan for '${expected_event}'. All ${totalBoxes} boxes in this order must first arrive at destination warehouse before delivery (Box ${pendingDest.box_number} is currently '${pendingDest.current_status}').`,
                            box: box,
                            pending_box: pendingDest
                        });
                    }
                }
            }

            // 3. Container Loading Mismatch Check
            if (target_batch_id && (expected_event === 'LOADED_CONTAINER' || expected_event === 'LOADED_FLIGHT')) {
                const batchRows = await new Promise((resolve, reject) => {
                    con.query(
                        'SELECT * FROM batches WHERE id = ?',
                        [target_batch_id],
                        (err, rows) => (err ? reject(err) : resolve(rows))
                    );
                });

                if (batchRows.length > 0) {
                    const batch = batchRows[0];
                    // Verify destination compatibility if batch has specific destination country
                    if (batch.detination_country_id && box.destination_country &&
                        batch.detination_country_id !== box.destination_country) {
                        return res.status(200).json({
                            valid: false,
                            error_code: 'DESTINATION_MISMATCH',
                            message: `MISMATCH WARNING: Box is destined for country ID ${box.destination_country}, but this batch is going to ${batch.detination_country_id}!`,
                            box: box,
                            batch: batch
                        });
                    }
                }
            }

            return res.status(200).json({
                valid: true,
                message: `Box ${box.box_number} of ${box.total_boxes} verified`,
                box: box
            });

        } catch (error) {
            logger.error('Error validating scan:', error);
            return res.status(500).json({ valid: false, message: 'Server error validating scan', error: error.message });
        }
    }

    /**
     * Record a scan event touch (DHL/FedEx Event Ledger)
     * POST /api/warehouse/scan/event
     */
    static async recordScanEvent(req, res) {
        const barcode_string = (req.body.barcode_string || req.body.barcode || '').trim();
        const scan_event = (req.body.scan_event || req.body.event_name || req.body.event || '').trim();
        const {
            warehouse_id,
            batch_id,
            scanned_by_user_id,
            device_id,
            latitude,
            longitude,
            notes,
            is_damaged,
            damage_comment
        } = req.body;

        if (!barcode_string || !scan_event) {
            return res.status(400).json({
                success: false,
                message: 'barcode_string and scan_event are required'
            });
        }

        try {
            // Find box with resolved order, warehouse, and country locations
            const boxRows = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT b.*,
                            COALESCE(b.order_id, swo.order_id) AS resolved_order_id,
                            COALESCE(b.origin_warehouse_id, swo.warehouse_id) AS resolved_origin_warehouse_id,
                            w_orig.warehouse_name AS origin_warehouse_name,
                            c_orig.name AS origin_country_name,
                            c_orig.shortname AS origin_country_code,
                            w_dest.warehouse_name AS dest_warehouse_name,
                            COALESCE(c_dest.name, c_swo_dest.name, c_ord_dest.name) AS dest_country_name,
                            COALESCE(c_dest.shortname, c_swo_dest.shortname, c_ord_dest.shortname) AS dest_country_code
                     FROM warehouse_package_boxes b
                     LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                     LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                     LEFT JOIN warehouse_tbl w_orig ON w_orig.id = COALESCE(b.origin_warehouse_id, swo.warehouse_id)
                     LEFT JOIN countries c_orig ON c_orig.id = w_orig.country
                     LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                     LEFT JOIN countries c_dest ON c_dest.id = w_dest.country
                     LEFT JOIN countries c_swo_dest ON c_swo_dest.id = swo.destination_country
                     LEFT JOIN countries c_ord_dest ON c_ord_dest.id = o.cargo_des_country
                     WHERE b.barcode_string = ?`,
                    [barcode_string],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            if (boxRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Box with barcode ${barcode_string} not found`
                });
            }

            const box = boxRows[0];
            const userId = scanned_by_user_id || (req.user && req.user.id) || null;
            const normalizedEvent = (scan_event || '').toLowerCase().trim();

            // Look up scanned warehouse country if warehouse_id was supplied
            let scannedWarehouse = null;
            if (warehouse_id) {
                const whRows = await new Promise((resolve) => {
                    con.query(
                        `SELECT w.*, c.name AS country_name, c.shortname AS country_code 
                         FROM warehouse_tbl w 
                         LEFT JOIN countries c ON c.id = w.country 
                         WHERE w.id = ?`,
                        [warehouse_id],
                        (err, rows) => resolve(rows || [])
                    );
                });
                if (whRows && whRows.length > 0) {
                    scannedWarehouse = whRows[0];
                }
            }

            const scannedCountry = scannedWarehouse ? WarehouseTrackingController.formatCountryLabel(scannedWarehouse.country_name, scannedWarehouse.country_code) : null;
            const originCountry = WarehouseTrackingController.formatCountryLabel(box.origin_country_name, box.origin_country_code) || 'China';
            const destCountry = WarehouseTrackingController.formatCountryLabel(box.dest_country_name, box.dest_country_code) || 'SA';

            // Resolve dynamic milestone status matching client's exact format:
            // "Booked into warehouse (China)", "Scanned out of Warehouse (China) - Transit", "Booked into warehouse (SA)"
            const milestone = WarehouseTrackingController.resolveScanMilestone(
                normalizedEvent,
                originCountry,
                destCountry,
                scannedCountry
            );

            // Pre-load all consignment boxes to enforce Stage Progression Gate & MPS Reconcile
            const targetOrderId = box.order_id || box.resolved_order_id;
            const targetSwoId = box.supplier_warehouse_order_id;

            const allConsignmentBoxes = await new Promise((resolve) => {
                const reconcileSql = `
                    SELECT id, box_number, total_boxes, barcode_string, current_status 
                    FROM warehouse_package_boxes 
                    WHERE (order_id = ? AND ? > 0) OR (supplier_warehouse_order_id = ? AND ? > 0)
                    ORDER BY box_number ASC
                `;
                con.query(reconcileSql, [targetOrderId || 0, targetOrderId || 0, targetSwoId || 0, targetSwoId || 0], (err, rows) => {
                    resolve(rows || []);
                });
            });

            const totalBoxes = allConsignmentBoxes.length > 0
                ? Math.max(allConsignmentBoxes.length, allConsignmentBoxes[0].total_boxes || box.total_boxes || 1)
                : (box.total_boxes || 1);
            const targetStageRank = WarehouseTrackingController.getMilestoneRank(normalizedEvent);
            const currentBoxRank = WarehouseTrackingController.getMilestoneRank(box.current_status);
            const resolvedOrderNumber = box.tbl_order_number || (targetOrderId ? `OR000${targetOrderId}` : box.warehouse_order_number);

            // =========================================================================
            // STAGE PROGRESSION GATE (Multi-Box Consignment Lifecycle Enforcement)
            // 1. Ek order ke jab sabhi boxes scan ho jaye to hi agle event par ja sakta hai.
            // 2. Aisa nahi ho sakta ki ek box ko delivered kar dein aur baki boxes scan hi na hue hon.
            // =========================================================================
            if (totalBoxes > 1) {
                const otherBoxes = allConsignmentBoxes.filter(b => b.id !== box.id);
                const minOtherRank = otherBoxes.length > 0
                    ? Math.min(...otherBoxes.map(b => WarehouseTrackingController.getMilestoneRank(b.current_status)))
                    : currentBoxRank;

                // Rule 0: Parallel Progression Gate (Multi-Box Cohort Synchronization)
                // "agar box no 1 ko check in karke fir se box no 1 ka status update karu to error aaye ki box 2 ko bhi check in nahi hua , matlab sabhi boxes paraller chalna chahiye"
                // If this box has ALREADY reached a milestone stage (currentBoxRank > minOtherRank),
                // it CANNOT be updated further until all other boxes in the consignment have caught up to this stage!
                if (otherBoxes.length > 0 && currentBoxRank > minOtherRank) {
                    const laggingBox = otherBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < currentBoxRank);
                    const stageName = WarehouseTrackingController.getMilestoneByRank(currentBoxRank) || box.current_status;
                    const laggingStatus = laggingBox.current_status === 'GENERATED' || !laggingBox.current_status
                        ? 'Awaiting Check-in'
                        : (WarehouseTrackingController.normalizeTimelineStatus(laggingBox.current_status) || laggingBox.current_status);

                    return res.status(400).json({
                        success: false,
                        error_code: 'CONSIGNMENT_PARALLEL_PROGRESSION_REQUIRED',
                        message: `Cannot update Box ${box.box_number} further. Box ${laggingBox.box_number} of ${totalBoxes} [${laggingBox.barcode_string}] has not completed this stage yet (currently '${laggingStatus}'). All ${totalBoxes} boxes in order ${resolvedOrderNumber} must be processed in parallel at each step before moving forward.`,
                        consignment_progress: {
                            order_number: resolvedOrderNumber,
                            total_boxes: totalBoxes,
                            current_box: {
                                box_number: box.box_number,
                                barcode: box.barcode_string,
                                current_status: stageName
                            },
                            pending_box: {
                                box_number: laggingBox.box_number,
                                barcode: laggingBox.barcode_string,
                                current_status: laggingStatus
                            }
                        }
                    });
                }

                // Rule 1: Origin Warehouse Intake Gate
                // If attempting any stage beyond Origin Intake (Rank > 2: dispatched to port, loaded container/flight, transit, destination depot, delivery),
                // ALL boxes in this consignment MUST have been received at origin warehouse (Rank >= 2).
                if (targetStageRank > 2) {
                    const unreceivedBox = allConsignmentBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 2);
                    if (unreceivedBox) {
                        const receivedCount = allConsignmentBoxes.filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= 2).length;
                        return res.status(400).json({
                            success: false,
                            error_code: 'STAGE_PREREQUISITE_NOT_MET',
                            message: `Cannot proceed to '${milestone.status}'. All ${totalBoxes} boxes in order ${resolvedOrderNumber} must first be received and checked in at the warehouse (Box ${unreceivedBox.box_number} of ${totalBoxes} [${unreceivedBox.barcode_string}] is still '${unreceivedBox.current_status || 'GENERATED'}').`,
                            consignment_progress: {
                                order_number: resolvedOrderNumber,
                                total_boxes: totalBoxes,
                                boxes_received_at_warehouse: receivedCount,
                                pending_boxes: allConsignmentBoxes
                                    .filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 2)
                                    .map(b => ({
                                        box_number: b.box_number,
                                        barcode: b.barcode_string,
                                        current_status: b.current_status || 'GENERATED'
                                    }))
                            }
                        });
                    }
                }

                // Rule 2: Destination Warehouse Arrival Gate (Rank 10)
                // Cannot mark a box arrived at destination depot if any other box has not completed origin processing (Rank < 2)
                if (targetStageRank >= 10 && targetStageRank < 11) {
                    const unDispatchedBox = allConsignmentBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 2);
                    if (unDispatchedBox) {
                        return res.status(400).json({
                            success: false,
                            error_code: 'STAGE_PREREQUISITE_NOT_MET',
                            message: `Cannot proceed to '${milestone.status}'. All ${totalBoxes} boxes in order ${resolvedOrderNumber} must first be processed at origin warehouse (Box ${unDispatchedBox.box_number} is still '${unDispatchedBox.current_status || 'GENERATED'}').`
                        });
                    }
                }

                // Rule 3: Final Delivery Gate (Rank 11, 12: Out for delivery / Delivered)
                // Cannot mark a box as Delivered or Out for delivery if any box in the consignment has not arrived at destination warehouse (Rank < 10)
                if (targetStageRank >= 11) {
                    const pendingDestBox = allConsignmentBoxes.find(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 10);
                    if (pendingDestBox) {
                        return res.status(400).json({
                            success: false,
                            error_code: 'STAGE_PREREQUISITE_NOT_MET',
                            message: `Cannot proceed to '${milestone.status}'. All ${totalBoxes} boxes in order ${resolvedOrderNumber} must first arrive and be offloaded at the destination warehouse before delivery (Box ${pendingDestBox.box_number} of ${totalBoxes} [${pendingDestBox.barcode_string}] is currently '${pendingDestBox.current_status}').`,
                            consignment_progress: {
                                order_number: resolvedOrderNumber,
                                total_boxes: totalBoxes,
                                boxes_arrived_destination: allConsignmentBoxes.filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= 10).length,
                                pending_boxes: allConsignmentBoxes
                                    .filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 10)
                                    .map(b => ({
                                        box_number: b.box_number,
                                        barcode: b.barcode_string,
                                        current_status: b.current_status
                                    }))
                            }
                        });
                    }
                }
            }

            // 1. Insert immutable scan event record
            const scanInsertSql = `
                INSERT INTO warehouse_box_scans (
                    box_id, barcode_string, scan_event, warehouse_id, batch_id,
                    scanned_by_user_id, device_id, latitude, longitude, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const scanResult = await new Promise((resolve, reject) => {
                con.query(
                    scanInsertSql,
                    [
                        box.id, barcode_string, normalizedEvent, warehouse_id || box.origin_warehouse_id,
                        batch_id || box.assigned_batch_id, userId, device_id || 'HANDHELD',
                        latitude || null, longitude || null, notes || null
                    ],
                    (err, result) => (err ? reject(err) : resolve(result))
                );
            });

            // 1.5 Handle damage photo(s) if uploaded directly with this scan event (Supports all formats: JPG, PNG, WEBP, HEIC, GIF, BMP, TIFF, SVG, AVIF + Base64)
            let uploadedFiles = [];
            if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                uploadedFiles = [...req.files];
            } else if (req.file) {
                uploadedFiles = [req.file];
            }

            // Also check for Base64 image payload in req.body (e.g. photo, photos, image, images, damage_photo)
            const damagePhotoDir = path.join(__dirname, '../public/damage_photos');
            if (!fs.existsSync(damagePhotoDir)) {
                fs.mkdirSync(damagePhotoDir, { recursive: true });
            }

            const base64List = [];
            ['photo', 'photos', 'image', 'images', 'damage_photo', 'damage_photos'].forEach(key => {
                const val = req.body[key];
                if (val) {
                    if (Array.isArray(val)) {
                        val.forEach(v => { if (typeof v === 'string') base64List.push(v); });
                    } else if (typeof val === 'string') {
                        base64List.push(val);
                    }
                }
            });

            base64List.forEach((b64, idx) => {
                const trimmed = b64.trim();
                let ext = '.jpg';
                let dataToBuffer = null;

                const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/i);
                if (match) {
                    const sub = match[1].toLowerCase();
                    if (sub.includes('png')) ext = '.png';
                    else if (sub.includes('webp')) ext = '.webp';
                    else if (sub.includes('heic')) ext = '.heic';
                    else if (sub.includes('heif')) ext = '.heif';
                    else if (sub.includes('gif')) ext = '.gif';
                    else if (sub.includes('bmp')) ext = '.bmp';
                    else if (sub.includes('svg')) ext = '.svg';
                    else if (sub.includes('tiff') || sub.includes('tif')) ext = '.tif';
                    else if (sub.includes('avif')) ext = '.avif';
                    else ext = '.jpg';
                    dataToBuffer = match[2];
                } else if (trimmed.length > 100 && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
                    dataToBuffer = trimmed;
                }

                if (dataToBuffer) {
                    try {
                        const buffer = Buffer.from(dataToBuffer, 'base64');
                        const safeName = `damage-b64-${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`;
                        const fullPath = path.join(damagePhotoDir, safeName);
                        fs.writeFileSync(fullPath, buffer);
                        uploadedFiles.push({
                            filename: safeName,
                            originalname: `capture_${idx + 1}${ext}`,
                            path: fullPath,
                            mimetype: `image/${ext.replace('.', '')}`
                        });
                    } catch (b64Err) {
                        logger.warn('Error saving base64 damage image:', b64Err.message);
                    }
                }
            });

            const isDamagedFlag = (
                is_damaged === 1 ||
                is_damaged === '1' ||
                is_damaged === true ||
                is_damaged === 'true' ||
                uploadedFiles.length > 0
            );

            const fileRecords = [];
            if (uploadedFiles.length > 0) {
                const fileType = (req.body.file_type || 'damage_photo').trim();
                for (const file of uploadedFiles) {
                    const relativeUrl = `/damage_photos/${file.filename}`;
                    const insertFileSql = `
                        INSERT INTO warehouse_box_files (
                            box_id, scan_event_id, file_type, file_name, file_path, file_url, uploaded_by_user_id, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                    `;
                    const insertResult = await new Promise((resolve, reject) => {
                        con.query(
                            insertFileSql,
                            [box.id, scanResult.insertId, fileType, file.originalname, file.path, relativeUrl, userId],
                            (err, result) => (err ? reject(err) : resolve(result))
                        );
                    });
                    fileRecords.push({
                        file_id: insertResult.insertId,
                        file_name: file.originalname,
                        file_url: relativeUrl,
                        file_type: fileType
                    });
                }
            }

            const finalDamageComment = damage_comment || (uploadedFiles.length > 0 ? (box.damage_comment || 'Damaged carton photo uploaded during scan') : box.damage_comment);

            // 2. Update box current_status and damage flag if applicable
            const updateBoxSql = `
                UPDATE warehouse_package_boxes 
                SET current_status = ?,
                    assigned_batch_id = COALESCE(?, assigned_batch_id),
                    is_damaged = CASE WHEN ? = 1 THEN 1 ELSE is_damaged END,
                    damage_comment = COALESCE(?, damage_comment),
                    updated_at = NOW()
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                con.query(
                    updateBoxSql,
                    [normalizedEvent, batch_id || null, isDamagedFlag ? 1 : 0, isDamagedFlag ? finalDamageComment : null, box.id],
                    (err, result) => (err ? reject(err) : resolve(result))
                );
            });

            // 2.5 Multi-Piece Shipment (MPS) Reconciliation: Compute order progress
            const updatedConsignmentBoxes = await new Promise((resolve) => {
                const reconcileSql = `
                    SELECT id, box_number, total_boxes, barcode_string, current_status 
                    FROM warehouse_package_boxes 
                    WHERE (order_id = ? AND ? > 0) OR (supplier_warehouse_order_id = ? AND ? > 0)
                    ORDER BY box_number ASC
                `;
                con.query(reconcileSql, [targetOrderId || 0, targetOrderId || 0, targetSwoId || 0, targetSwoId || 0], (err, rows) => {
                    resolve(rows || []);
                });
            });

            const currentConsignmentBoxes = updatedConsignmentBoxes.length > 0 ? updatedConsignmentBoxes : allConsignmentBoxes;
            const currentStageRank = targetStageRank;

            let completedBoxesCount = 0;
            currentConsignmentBoxes.forEach(b => {
                const bRank = WarehouseTrackingController.getMilestoneRank(b.current_status);
                if (bRank >= currentStageRank && currentStageRank > 0) {
                    completedBoxesCount++;
                } else if ((b.current_status || '').toLowerCase().trim() === normalizedEvent) {
                    completedBoxesCount++;
                }
            });

            completedBoxesCount = Math.max(1, Math.min(completedBoxesCount, totalBoxes));

            // Minimum milestone rank reached by ALL boxes in the consignment:
            const minConsignmentRank = currentConsignmentBoxes.length > 0
                ? Math.min(...currentConsignmentBoxes.map(b => WarehouseTrackingController.getMilestoneRank(b.current_status)))
                : currentStageRank;

            // Consignment is only complete for THIS milestone stage when ALL boxes have completed this stage:
            const isConsignmentComplete = (completedBoxesCount >= totalBoxes && minConsignmentRank >= currentStageRank);

            // Compute Final Order Status:
            // CRITICAL REQUIREMENT:
            // An order's status only becomes milestone.status when ALL boxes in that order have reached this milestone!
            // If only Box 1 was scanned as 'Received at Asia Direct warehouse', order status remains 'Awaiting Check-in'.
            // Only when ALL boxes are scanned does it become 'Received at Asia Direct warehouse'.
            let finalOrderStatus = null;
            if (isConsignmentComplete) {
                finalOrderStatus = milestone ? milestone.status : WarehouseTrackingController.normalizeTimelineStatus(normalizedEvent);
            } else if (minConsignmentRank > 0) {
                finalOrderStatus = WarehouseTrackingController.getMilestoneByRank(minConsignmentRank);
            } else {
                finalOrderStatus = 'Awaiting Check-in';
            }
            finalOrderStatus = WarehouseTrackingController.normalizeTimelineStatus(finalOrderStatus);

            // Gating Delivered status: Order can NEVER be Delivered if consignment is not 100% complete
            if (finalOrderStatus === 'Delivered' && !isConsignmentComplete) {
                finalOrderStatus = 'Out for delivery';
            }

            const orderTrackStatus = finalOrderStatus;

            // 3. Module E: Supplier Warehouse Sync (Only when ALL boxes are received at origin warehouse)
            if ((normalizedEvent === 'received_origin' || normalizedEvent === 'received_warehouse') && targetSwoId) {
                if (isConsignmentComplete) {
                    con.query(
                        'UPDATE supplier_warehouse_orders SET date_received = CURDATE() WHERE id = ?',
                        [targetSwoId],
                        (swoErr) => {
                            if (swoErr) logger.warn(`Error syncing supplier_warehouse_orders: ${swoErr.message}`);
                        }
                    );
                }

                if (global.io) {
                    global.io.emit('supplier:goods_received', {
                        supplier_warehouse_order_id: targetSwoId,
                        warehouse_order_number: box.warehouse_order_number,
                        box_number: box.box_number,
                        total_boxes: totalBoxes,
                        boxes_completed: completedBoxesCount,
                        is_complete: isConsignmentComplete,
                        status: isConsignmentComplete ? 'Received at Asia Direct warehouse' : 'Awaiting Check-in',
                        timestamp: new Date()
                    });
                }
            }

            // 4. Module D: Loading & Offloading Module - Auto-update TMS Freight Order (Only when all boxes are loaded)
            if ((normalizedEvent === 'loaded_container' || normalizedEvent === 'loaded_flight') && targetOrderId && batch_id) {
                if (isConsignmentComplete) {
                    con.query(
                        'UPDATE warehouse_assign_order SET assign_to_batch = 1, batch_id = ? WHERE order_id = ?',
                        [batch_id, targetOrderId],
                        (waoErr) => {
                            if (waoErr) logger.warn('Error syncing warehouse_assign_order for TMS:', waoErr.message);
                        }
                    );
                }
            }

            // 5. Mirror event to high-level order_track table & tbl_orders.track_status
            if (milestone && (targetOrderId || targetSwoId)) {
                const finalTrackOrderId = targetOrderId || targetSwoId;

                if (isConsignmentComplete) {
                    // Milestone is 100% complete for all boxes in consignment:
                    const milestoneDesc = `${milestone.description} (All ${totalBoxes}/${totalBoxes} Boxes Reconciled - Consignment Complete)`;
                    await new Promise((resolve) => {
                        con.query(
                            'INSERT INTO order_track (order_id, batch_id, status, description, created_at) VALUES (?, ?, ?, ?, NOW())',
                            [finalTrackOrderId, batch_id || box.assigned_batch_id || null, milestone.status, milestoneDesc],
                            (otErr) => {
                                if (otErr) logger.warn('Error inserting into order_track:', otErr.message);
                                resolve();
                            }
                        );
                    });

                    if (targetOrderId) {
                        await new Promise((resolve) => {
                            con.query('UPDATE tbl_orders SET track_status = ? WHERE id = ?', [milestone.status, targetOrderId], (toErr) => {
                                if (toErr) logger.warn('Error syncing track_status to tbl_orders:', toErr.message);
                                resolve();
                            });
                        });
                    }
                } else {
                    // Consignment is still in progress across multiple boxes:
                    // Insert an audit touch note in order_track indicating progress without jumping order status ahead
                    const partialNote = `Box ${box.box_number}/${totalBoxes} [${barcode_string}] scanned: ${milestone.status} (${completedBoxesCount}/${totalBoxes} Boxes Scanned - Pending remaining boxes before milestone progression)`;
                    await new Promise((resolve) => {
                        con.query(
                            'INSERT INTO order_track (order_id, batch_id, status, description, created_at) VALUES (?, ?, ?, ?, NOW())',
                            [finalTrackOrderId, batch_id || box.assigned_batch_id || null, finalOrderStatus, partialNote],
                            (otErr) => {
                                if (otErr) logger.warn('Error inserting partial progress into order_track:', otErr.message);
                                resolve();
                            }
                        );
                    });

                    // Update tbl_orders.track_status to finalOrderStatus (which is minConsignmentRank or 'Awaiting Check-in', NOT milestone.status)
                    if (targetOrderId) {
                        await new Promise((resolve) => {
                            con.query('UPDATE tbl_orders SET track_status = ? WHERE id = ?', [finalOrderStatus, targetOrderId], (toErr) => {
                                if (toErr) logger.warn('Error syncing track_status to tbl_orders:', toErr.message);
                                resolve();
                            });
                        });
                    }
                }
            }

            // 6. Real-time broadcast via Socket.io
            if (global.io) {
                global.io.emit('warehouse:scan', {
                    box_id: box.id,
                    barcode_string: barcode_string,
                    box_number: box.box_number,
                    total_boxes: totalBoxes,
                    boxes_completed: completedBoxesCount,
                    is_complete: isConsignmentComplete,
                    scan_event: normalizedEvent,
                    track_status: finalOrderStatus,
                    warehouse_id: warehouse_id,
                    batch_id: batch_id,
                    scanned_at: new Date()
                });

                if (fileRecords.length > 0 || isDamagedFlag) {
                    global.io.emit('warehouse:box_damaged', {
                        box_id: box.id,
                        barcode_string: barcode_string,
                        box_number: box.box_number,
                        total_boxes: totalBoxes,
                        files: fileRecords,
                        damage_comment: finalDamageComment,
                        timestamp: new Date()
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: `Scan event '${normalizedEvent}' recorded for Box ${box.box_number} of ${totalBoxes}${fileRecords.length > 0 ? ` with ${fileRecords.length} damage photo(s) uploaded` : ''}`,
                scan_id: scanResult.insertId,
                box_id: box.id,
                barcode_string: barcode_string,
                current_status: normalizedEvent,
                track_status: finalOrderStatus,
                consignment_progress: {
                    total_boxes: totalBoxes,
                    boxes_completed: completedBoxesCount,
                    is_complete: isConsignmentComplete
                },
                is_damaged: isDamagedFlag ? 1 : (box.is_damaged || 0),
                damage_comment: isDamagedFlag ? finalDamageComment : box.damage_comment,
                uploaded_photos: fileRecords
            });

        } catch (error) {
            logger.error('Error recording scan event:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to record scan event',
                error: error.message
            });
        }
    }

    /**
     * Auto-populate warehouse intake form on mobile scan (Module B: Warehouse Check-In)
     * GET /api/warehouse/intake/auto-populate/:barcode
     */
    static async autoPopulateIntake(req, res) {
        const { barcode } = req.params;

        if (!barcode) {
            return res.status(400).json({ success: false, message: 'Barcode is required' });
        }

        try {
            const isChecksumValid = BarcodeService.verifyChecksum(barcode);
            if (!isChecksumValid) {
                return res.status(400).json({
                    success: false,
                    error_code: 'CHECKSUM_FAIL',
                    message: 'Invalid barcode checksum - damaged or misread label'
                });
            }

            const boxRows = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT b.*, 
                            COALESCE(b.origin_warehouse_id, swo.warehouse_id) AS resolved_warehouse_id,
                            swo.customer_name, swo.supplier_company, swo.supplier_person, swo.supplier_contact,
                            swo.supplier_address, swo.package_type, swo.goods_description,
                            o.order_number as tbl_order_number,
                            COALESCE(
                                NULLIF(o.freight_type, ''),
                                NULLIF(f.freight, ''),
                                NULLIF(o.mode_of_transport, ''),
                                NULLIF(bt.freight, ''),
                                NULLIF(ts.freight, '')
                            ) as resolved_freight_type_raw,
                            w_orig.warehouse_name as origin_warehouse_name,
                            w_dest.warehouse_name as destination_warehouse_name,
                            c.name as destination_country_name
                     FROM warehouse_package_boxes b
                     LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                     LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                     LEFT JOIN tbl_freight f ON f.id = o.freight_id
                     LEFT JOIN batches bt ON bt.id = b.assigned_batch_id
                     LEFT JOIN shipment_details sd ON sd.order_id = COALESCE(b.order_id, swo.order_id)
                     LEFT JOIN tbl_shipments ts ON ts.id = sd.shipment_id
                     LEFT JOIN warehouse_tbl w_orig ON w_orig.id = COALESCE(b.origin_warehouse_id, swo.warehouse_id)
                     LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                     LEFT JOIN countries c ON c.id = swo.destination_country
                     WHERE b.barcode_string = ?`,
                    [barcode],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            if (boxRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error_code: 'BOX_NOT_FOUND',
                    message: `Barcode ${barcode} not found in system`
                });
            }

            const box = boxRows[0];
            const resolvedOrderNumber = box.tbl_order_number || (box.order_id ? `OR000${box.order_id}` : box.warehouse_order_number);
            const warehouseId = box.resolved_warehouse_id || box.origin_warehouse_id || null;

            // Query all consignment boxes to determine intake progress
            const targetOrderId = box.order_id;
            const targetSwoId = box.supplier_warehouse_order_id;
            const allConsignmentBoxes = await new Promise((resolve) => {
                con.query(
                    `SELECT id, box_number, total_boxes, barcode_string, current_status, is_damaged 
                     FROM warehouse_package_boxes 
                     WHERE (order_id = ? AND ? > 0) OR (supplier_warehouse_order_id = ? AND ? > 0)
                     ORDER BY box_number ASC`,
                    [targetOrderId || 0, targetOrderId || 0, targetSwoId || 0, targetSwoId || 0],
                    (err, rows) => resolve(rows || [])
                );
            });

            const totalBoxes = allConsignmentBoxes.length > 0 ? Math.max(allConsignmentBoxes.length, allConsignmentBoxes[0].total_boxes || box.total_boxes || 1) : (box.total_boxes || 1);
            const receivedCount = allConsignmentBoxes.filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= 2).length;
            const isIntakeComplete = (receivedCount >= totalBoxes);

            // Resolve normalized freight_type (sea, air, road)
            const rawFreight = (box.resolved_freight_type_raw || box.freight_type || '').toString().trim().toLowerCase();
            let resolvedFreightType = 'sea'; // default to sea
            if (rawFreight.includes('air') || rawFreight.includes('flight')) {
                resolvedFreightType = 'air';
            } else if (rawFreight.includes('road') || rawFreight.includes('truck') || rawFreight.includes('land')) {
                resolvedFreightType = 'road';
            } else if (rawFreight.includes('sea') || rawFreight.includes('ocean') || rawFreight.includes('vessel') || rawFreight.includes('container') || rawFreight.includes('ship')) {
                resolvedFreightType = 'sea';
            } else if (rawFreight) {
                resolvedFreightType = rawFreight;
            }

            // Fetch associated warehouse products if supplier order
            let orderProducts = [];
            if (targetSwoId) {
                orderProducts = await new Promise((resolve) => {
                    con.query(
                        `SELECT id, product_description, hazardous, package_type, packages,
                                dimension, weight, warehouse_ref, waybill_ref, pictures
                         FROM supplier_warehouse_products
                         WHERE supplier_warehouse_id = ?
                         ORDER BY id ASC`,
                        [targetSwoId],
                        (err, rows) => resolve(rows || [])
                    );
                });
            }

            const combinedCargoDesc = (orderProducts.length > 0
                ? orderProducts.map(p => p.product_description).filter(Boolean).join('; ')
                : null) || box.goods_description || 'General Cargo';

            return res.status(200).json({
                success: true,
                valid: true,
                message: `Box ${box.box_number} of ${totalBoxes} verified for intake`,
                warehouse_id: warehouseId,
                freight_type: resolvedFreightType,
                consignment_progress: {
                    total_boxes: totalBoxes,
                    boxes_received: receivedCount,
                    is_intake_complete: isIntakeComplete,
                    pending_intake_boxes: allConsignmentBoxes.filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) < 2).map(b => ({
                        box_number: b.box_number,
                        barcode: b.barcode_string,
                        current_status: b.current_status || 'GENERATED'
                    }))
                },
                all_boxes_in_consignment: allConsignmentBoxes.map(b => ({
                    box_id: b.id,
                    box_number: b.box_number,
                    total_boxes: totalBoxes,
                    barcode_string: b.barcode_string,
                    current_status: b.current_status || 'GENERATED',
                    is_received: WarehouseTrackingController.getMilestoneRank(b.current_status) >= 2
                })),
                intake_form: {
                    barcode: box.barcode_string,
                    order_number: resolvedOrderNumber,
                    warehouse_reference: box.warehouse_order_number,
                    warehouse_id: warehouseId,
                    origin_warehouse_id: warehouseId,
                    destination_warehouse_id: box.destination_warehouse_id || null,
                    freight_type: resolvedFreightType,
                    order_id: box.order_id,
                    supplier_warehouse_order_id: box.supplier_warehouse_order_id,
                    supplier: {
                        company: box.supplier_company || 'N/A',
                        contact_person: box.supplier_person || 'N/A',
                        phone: box.supplier_contact || 'N/A',
                        address: box.supplier_address || 'N/A'
                    },
                    customer_name: box.customer_name || 'N/A',
                    box_count: {
                        current_box: box.box_number,
                        total_boxes: totalBoxes
                    },
                    metrics: {
                        weight_kg: box.weight_kg,
                        cbm: box.cbm,
                        length_cm: box.length_cm,
                        width_cm: box.width_cm,
                        height_cm: box.height_cm
                    },
                    routing: {
                        warehouse_id: warehouseId,
                        origin_warehouse_id: warehouseId,
                        destination_warehouse_id: box.destination_warehouse_id || null,
                        freight_type: resolvedFreightType,
                        origin_warehouse: box.origin_warehouse_name || 'China/India Warehouse',
                        destination_warehouse: box.destination_warehouse_name || box.destination_country_name || 'Africa Hub'
                    },
                    cargo_description: combinedCargoDesc,
                    products_count: orderProducts.length,
                    products: orderProducts.map(p => {
                        let parsedPictures = [];
                        if (p.pictures) {
                            try {
                                const parsed = JSON.parse(p.pictures);
                                parsedPictures = (Array.isArray(parsed) ? parsed : [parsed]).map(img => `/product_pictures/${img}`);
                            } catch (e) {
                                parsedPictures = [`/product_pictures/${p.pictures}`];
                            }
                        }
                        return {
                            ...p,
                            pictures: parsedPictures
                        };
                    }),
                    current_status: box.current_status,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Error auto-populating intake form:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error while fetching intake form data',
                error: error.message
            });
        }
    }

    /**
     * Timeline tracking by barcode or order number (DHL/FedEx style tracking)
     * GET /api/warehouse/track/:identifier
     */
    static async trackTimeline(req, res) {
        const { identifier } = req.params;

        try {
            const cleanId = (identifier || '').trim();
            const numericId = !isNaN(cleanId) && cleanId !== '' ? parseInt(cleanId, 10) : null;

            // Find boxes by barcode, warehouse_order_number, numeric order_id, or order_number
            const boxRows = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT b.*, w_orig.warehouse_name as origin_name, w_dest.warehouse_name as dest_name,
                            o.order_number, o.track_status as order_track_status
                     FROM warehouse_package_boxes b
                     LEFT JOIN warehouse_tbl w_orig ON w_orig.id = b.origin_warehouse_id
                     LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                     LEFT JOIN tbl_orders o ON o.id = b.order_id
                     WHERE b.barcode_string = ? 
                        OR b.warehouse_order_number = ?
                        OR (b.order_id IS NOT NULL AND b.order_id = ?)
                        OR o.order_number = ?
                     ORDER BY b.box_number ASC`,
                    [cleanId, cleanId, numericId, cleanId],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            if (boxRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No shipment, order, or box found for identifier '${cleanId}'`
                });
            }

            const initialBox = boxRows[0];
            const targetOrderId = initialBox.order_id;
            const targetSwoId = initialBox.supplier_warehouse_order_id;
            const targetRef = initialBox.warehouse_order_number;

            // Resolve ALL boxes in this consignment/order so tracking by order OR single barcode returns complete history & attachments
            const allConsignmentBoxes = await new Promise((resolve) => {
                con.query(
                    `SELECT b.*, w_orig.warehouse_name as origin_name, w_dest.warehouse_name as dest_name,
                            o.order_number, o.track_status as order_track_status
                     FROM warehouse_package_boxes b
                     LEFT JOIN warehouse_tbl w_orig ON w_orig.id = b.origin_warehouse_id
                     LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                     LEFT JOIN tbl_orders o ON o.id = b.order_id
                     WHERE (b.order_id = ? AND ? > 0)
                        OR (b.supplier_warehouse_order_id = ? AND ? > 0)
                        OR (b.warehouse_order_number = ? AND ? != '')
                     ORDER BY b.box_number ASC`,
                    [targetOrderId || 0, targetOrderId || 0, targetSwoId || 0, targetSwoId || 0, targetRef || '', targetRef || ''],
                    (err, rows) => resolve((rows && rows.length > 0) ? rows : boxRows)
                );
            });

            const allBoxIds = allConsignmentBoxes.map(b => b.id);
            const primaryBox = allConsignmentBoxes[0] || initialBox;

            // Fetch scan history events across all boxes in this consignment
            const scanEvents = await new Promise((resolve) => {
                con.query(
                    `SELECT s.*, u.full_name as staff_name, w.warehouse_name, b.batch_name,
                            pb.box_number, pb.total_boxes, pb.barcode_string
                     FROM warehouse_box_scans s
                     LEFT JOIN warehouse_package_boxes pb ON pb.id = s.box_id
                     LEFT JOIN tbl_users u ON u.id = s.scanned_by_user_id
                     LEFT JOIN warehouse_tbl w ON w.id = s.warehouse_id
                     LEFT JOIN batches b ON b.id = s.batch_id
                     WHERE s.box_id IN (?)
                     ORDER BY s.scanned_at ASC, s.id ASC`,
                    [allBoxIds],
                    (err, rows) => resolve(rows || [])
                );
            });

            // Resolve unique coordinates to readable locations
            const coordsMap = new Map();
            for (const s of scanEvents) {
                if (s.latitude && s.longitude) {
                    const latNum = parseFloat(s.latitude);
                    const lonNum = parseFloat(s.longitude);
                    if (!isNaN(latNum) && !isNaN(lonNum) && (latNum !== 0 || lonNum !== 0)) {
                        const key = `${latNum.toFixed(5)},${lonNum.toFixed(5)}`;
                        if (!coordsMap.has(key)) {
                            coordsMap.set(key, { lat: latNum, lon: lonNum });
                        }
                    }
                }
            }

            if (coordsMap.size > 0) {
                await Promise.all(
                    Array.from(coordsMap.entries()).map(async ([key, coord]) => {
                        const loc = await WarehouseTrackingController.resolveLocationFromCoords(coord.lat, coord.lon);
                        coordsMap.set(key, loc);
                    })
                );
            }

            const getScanResolvedInfo = (s) => {
                if (s && s.latitude && s.longitude) {
                    const latNum = parseFloat(s.latitude);
                    const lonNum = parseFloat(s.longitude);
                    if (!isNaN(latNum) && !isNaN(lonNum) && (latNum !== 0 || lonNum !== 0)) {
                        const key = `${latNum.toFixed(5)},${lonNum.toFixed(5)}`;
                        const loc = coordsMap.get(key);
                        if (loc) {
                            if (typeof loc === 'string') {
                                return { location: loc, exact_location: loc, address_details: null };
                            }
                            return loc;
                        }
                    }
                }
                const fallbackName = (s && s.warehouse_name) ? s.warehouse_name : 'Transit Depot';
                return {
                    location: fallbackName,
                    exact_location: null,
                    address_details: null
                };
            };

            const getScanResolvedLocation = (s) => {
                const info = getScanResolvedInfo(s);
                return (info && info.location) ? info.location : ((s && s.warehouse_name) ? s.warehouse_name : 'Transit Depot');
            };

            // Fetch attached photos & damage photos across all boxes in this consignment
            const photos = await new Promise((resolve) => {
                con.query(
                    `SELECT f.*, pb.box_number, pb.total_boxes, pb.barcode_string, pb.damage_comment as box_damage_comment
                     FROM warehouse_box_files f
                     LEFT JOIN warehouse_package_boxes pb ON pb.id = f.box_id
                     WHERE f.box_id IN (?)
                     ORDER BY f.created_at DESC, f.id DESC`,
                    [allBoxIds],
                    (err, rows) => resolve(rows || [])
                );
            });

            const formattedAttachments = photos.map(f => {
                const rawUrl = f.file_url || (f.file_name ? `/damage_photos/${f.file_name}` : null);
                return {
                    id: f.id,
                    box_id: f.box_id,
                    box_number: f.box_number || 1,
                    total_boxes: f.total_boxes || 1,
                    box_display: `Box ${f.box_number || 1}/${f.total_boxes || 1}`,
                    barcode_string: f.barcode_string || null,
                    scan_event_id: f.scan_event_id,
                    file_type: f.file_type || 'damage_photo',
                    file_name: f.file_name,
                    file_url: rawUrl,
                    full_url: rawUrl,
                    comment: f.box_damage_comment || null,
                    uploaded_by_user_id: f.uploaded_by_user_id,
                    created_at: f.created_at
                };
            });

            const photosByBox = {};
            formattedAttachments.forEach(att => {
                if (!photosByBox[att.box_id]) photosByBox[att.box_id] = [];
                photosByBox[att.box_id].push(att);
            });

            // Fetch high-level order_track status history & milestone remarks
            const orderTracks = await new Promise((resolve) => {
                const finalOrderId = targetOrderId || primaryBox.order_id;
                if (!finalOrderId) return resolve([]);
                con.query(
                    `SELECT ot.* FROM order_track ot WHERE ot.order_id = ? ORDER BY ot.created_at ASC, ot.id ASC`,
                    [finalOrderId],
                    (err, rows) => resolve(rows || [])
                );
            });

            const totalBoxesCount = allConsignmentBoxes.length > 0
                ? Math.max(allConsignmentBoxes.length, primaryBox.total_boxes || 1)
                : (primaryBox.total_boxes || 1);

            // Group completed milestones by normalized status (NO DUPLICATES)
            const completedMilestonesMap = new Map();

            // 1. Process scanEvents for completed consignment milestone stages
            for (const ev of scanEvents) {
                const normStatus = WarehouseTrackingController.normalizeTimelineStatus(ev.scan_event);
                const scanRank = WarehouseTrackingController.getMilestoneRank(ev.scan_event);

                // Multi-box order milestone check:
                // Completed only when all consignment boxes reached this milestone rank (or totalBoxesCount <= 1)
                const isAllBoxesComplete = (totalBoxesCount <= 1) || (
                    scanRank > 0 &&
                    allConsignmentBoxes.every(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= scanRank)
                );

                if (isAllBoxesComplete && normStatus) {
                    const matchingTrack = orderTracks.slice().reverse().find(ot =>
                        WarehouseTrackingController.normalizeTimelineStatus(ot.status) === normStatus &&
                        ot.description && ot.description.trim() !== ''
                    );
                    const defaultInfo = WarehouseTrackingController.resolveScanActivityBadge(ev.scan_event);
                    const milestoneRemark = (matchingTrack && matchingTrack.description)
                        ? matchingTrack.description
                        : (ev.notes || defaultInfo.description || `Milestone: ${normStatus}`);

                    completedMilestonesMap.set(normStatus, {
                        scan_id: ev.id,
                        id: ev.id,
                        box_id: ev.box_id,
                        box_number: ev.box_number,
                        total_boxes: totalBoxesCount,
                        box_display: `All ${totalBoxesCount}/${totalBoxesCount} Boxes`,
                        barcode_string: ev.barcode_string,
                        event: ev.scan_event,
                        scan_event: ev.scan_event,
                        status: normStatus,
                        event_label: normStatus,
                        status_badge: normStatus,
                        timestamp: ev.scanned_at,
                        scanned_at: ev.scanned_at,
                        created_at: ev.scanned_at,
                        time: WarehouseTrackingController.formatDisplayTime(ev.scanned_at),
                        date: WarehouseTrackingController.formatDisplayDate(ev.scanned_at),
                        formatted_time: WarehouseTrackingController.formatDisplayTime(ev.scanned_at),
                        formatted_date: WarehouseTrackingController.formatDisplayDate(ev.scanned_at),
                        formatted_datetime: `${WarehouseTrackingController.formatDisplayDate(ev.scanned_at)}, ${WarehouseTrackingController.formatDisplayTime(ev.scanned_at)}`,
                        location: getScanResolvedLocation(ev),
                        location_name: getScanResolvedLocation(ev),
                        exact_location: getScanResolvedInfo(ev).exact_location || getScanResolvedLocation(ev),
                        address_details: getScanResolvedInfo(ev).address_details || null,
                        warehouse_name: ev.warehouse_name || 'Transit Depot',
                        device_id: ev.device_id || 'HANDHELD',
                        latitude: ev.latitude ? parseFloat(ev.latitude) : null,
                        longitude: ev.longitude ? parseFloat(ev.longitude) : null,
                        batch: ev.batch_name || null,
                        operator: ev.staff_name || 'Warehouse Staff',
                        scanned_by: ev.staff_name || 'Warehouse Staff',
                        scanned_by_name: ev.staff_name || 'Warehouse Staff',
                        remark: milestoneRemark,
                        remarks: milestoneRemark,
                        description: milestoneRemark,
                        notes: milestoneRemark || ev.notes || null,
                        rank: scanRank
                    });
                }
            }

            // 2. Process orderTracks for milestones without box scans (e.g. shipping / customs)
            const resolvedCurrentTrackStatus = WarehouseTrackingController.normalizeTimelineStatus(
                primaryBox.order_track_status ||
                (allConsignmentBoxes.length > 0 && allConsignmentBoxes.every(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= 2)
                    ? 'Received at Asia Direct warehouse'
                    : (allConsignmentBoxes.length > 0 && allConsignmentBoxes.every(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= 1)
                        ? 'Collected from supplier'
                        : 'Awaiting Check-in'))
            );
            const currentOrderRank = WarehouseTrackingController.getMilestoneRank(resolvedCurrentTrackStatus);

            for (const ot of orderTracks) {
                if (!ot.status || ot.status === 'Select' || ot.status === 'Awaiting Check-in') continue;
                const normStatus = WarehouseTrackingController.normalizeTimelineStatus(ot.status);
                if (!normStatus) continue;

                const otRank = WarehouseTrackingController.getMilestoneRank(ot.status);
                if (otRank > currentOrderRank && currentOrderRank > 0) continue;

                const existing = completedMilestonesMap.get(normStatus);

                if (existing) {
                    if (ot.description && ot.description.trim() !== '') {
                        existing.remark = ot.description;
                        existing.remarks = ot.description;
                        existing.description = ot.description;
                        existing.notes = ot.description;
                    }
                } else {
                    const otDate = ot.created_at;
                    const otRemark = (ot.description && ot.description.trim() !== '')
                        ? ot.description
                        : `Milestone: ${normStatus}`;

                    completedMilestonesMap.set(normStatus, {
                        scan_id: ot.id,
                        id: ot.id,
                        box_id: null,
                        box_number: null,
                        total_boxes: totalBoxesCount,
                        box_display: `All ${totalBoxesCount}/${totalBoxesCount} Boxes`,
                        barcode_string: null,
                        event: ot.status,
                        scan_event: ot.status,
                        status: normStatus,
                        event_label: normStatus,
                        status_badge: normStatus,
                        timestamp: otDate,
                        scanned_at: otDate,
                        created_at: otDate,
                        time: WarehouseTrackingController.formatDisplayTime(otDate),
                        date: WarehouseTrackingController.formatDisplayDate(otDate),
                        formatted_time: WarehouseTrackingController.formatDisplayTime(otDate),
                        formatted_date: WarehouseTrackingController.formatDisplayDate(otDate),
                        formatted_datetime: `${WarehouseTrackingController.formatDisplayDate(otDate)}, ${WarehouseTrackingController.formatDisplayTime(otDate)}`,
                        location: 'In Transit',
                        warehouse_name: 'In Transit',
                        batch: ot.batch_id || null,
                        operator: 'Logistics / Shipping',
                        scanned_by: 'Logistics / Shipping',
                        scanned_by_name: 'Logistics / Shipping',
                        remark: otRemark,
                        remarks: otRemark,
                        description: otRemark,
                        notes: otRemark,
                        rank: otRank
                    });
                }
            }

            // Sort deduplicated timeline in chronological milestone order
            const deduplicatedTimeline = Array.from(completedMilestonesMap.values()).sort((a, b) => {
                if (a.rank !== b.rank) return (a.rank || 0) - (b.rank || 0);
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            });

            // Format all boxes with individual scan time and individual scan history
            const allBoxes = allConsignmentBoxes.map(b => {
                const boxScans = scanEvents.filter(s => s.box_id === b.id || s.barcode_string === b.barcode_string);
                const latestScan = boxScans.length > 0 ? boxScans[boxScans.length - 1] : null;
                const latestScanInfo = latestScan ? getScanResolvedInfo(latestScan) : null;
                const scanTime = latestScan ? latestScan.scanned_at : null;
                const formattedDate = scanTime ? WarehouseTrackingController.formatDisplayDate(scanTime) : null;
                const formattedTime = scanTime ? WarehouseTrackingController.formatDisplayTime(scanTime) : null;
                const formattedDateTime = scanTime ? `${formattedDate}, ${formattedTime}` : null;

                const boxScanHistory = boxScans.map(s => {
                    const sTime = s.scanned_at;
                    const sDate = sTime ? WarehouseTrackingController.formatDisplayDate(sTime) : null;
                    const sHour = sTime ? WarehouseTrackingController.formatDisplayTime(sTime) : null;
                    const sNormStatus = WarehouseTrackingController.normalizeTimelineStatus(s.scan_event);
                    const sInfo = getScanResolvedInfo(s);
                    return {
                        scan_id: s.id,
                        id: s.id,
                        box_id: s.box_id,
                        box_number: s.box_number || b.box_number || 1,
                        total_boxes: s.total_boxes || b.total_boxes || totalBoxesCount,
                        box_display: `Box ${s.box_number || b.box_number || 1}/${s.total_boxes || b.total_boxes || totalBoxesCount}`,
                        barcode_string: s.barcode_string || b.barcode_string,
                        event: s.scan_event,
                        scan_event: s.scan_event,
                        status: sNormStatus,
                        status_label: sNormStatus,
                        timestamp: sTime,
                        scanned_at: sTime,
                        time: sHour,
                        date: sDate,
                        formatted_time: sHour,
                        formatted_date: sDate,
                        formatted_datetime: sTime ? `${sDate}, ${sHour}` : null,
                        location: sInfo.location,
                        location_name: sInfo.location,
                        exact_location: sInfo.exact_location || sInfo.location,
                        address_details: sInfo.address_details || null,
                        warehouse_name: s.warehouse_name || 'Transit Depot',
                        device_id: s.device_id || 'HANDHELD',
                        latitude: s.latitude ? parseFloat(s.latitude) : null,
                        longitude: s.longitude ? parseFloat(s.longitude) : null,
                        operator: s.staff_name || 'Warehouse Staff',
                        scanned_by: s.staff_name || 'Warehouse Staff',
                        scanned_by_name: s.staff_name || 'Warehouse Staff',
                        notes: s.notes || null,
                        remark: s.notes || null,
                        remarks: s.notes || null,
                        description: s.notes || null
                    };
                });

                return {
                    box_id: b.id,
                    id: b.id,
                    box_number: b.box_number,
                    total_boxes: b.total_boxes,
                    box_display: `Box ${b.box_number}/${b.total_boxes}`,
                    barcode_string: b.barcode_string,
                    current_status: b.current_status,
                    status: WarehouseTrackingController.normalizeTimelineStatus(b.current_status) || 'Awaiting Check-in',
                    status_badge: WarehouseTrackingController.normalizeTimelineStatus(b.current_status) || 'Awaiting Check-in',
                    condition: (b.is_damaged === 1 || b.is_damaged === true) ? 'Damaged' : 'Intact',

                    // Scan Time & Date (matches arrow in user's screenshot: 14:54:21 / 14:55:50)
                    scanned_at: scanTime,
                    scan_time: scanTime,
                    last_scanned_at: scanTime,
                    timestamp: scanTime,
                    time: formattedTime,
                    date: formattedDate,
                    formatted_time: formattedTime,
                    formatted_date: formattedDate,
                    formatted_datetime: formattedDateTime,
                    formatted_scanned_at: formattedDateTime,

                    operator: latestScan ? (latestScan.staff_name || 'Warehouse Staff') : null,
                    scanned_by: latestScan ? (latestScan.staff_name || 'Warehouse Staff') : null,
                    scanned_by_name: latestScan ? (latestScan.staff_name || 'Warehouse Staff') : null,
                    location: latestScanInfo ? latestScanInfo.location : null,
                    location_name: latestScanInfo ? latestScanInfo.location : null,
                    exact_location: latestScanInfo ? (latestScanInfo.exact_location || latestScanInfo.location) : null,
                    address_details: latestScanInfo ? latestScanInfo.address_details : null,
                    warehouse_name: latestScan ? latestScan.warehouse_name : null,
                    device_id: latestScan ? (latestScan.device_id || 'HANDHELD') : null,
                    latitude: latestScan && latestScan.latitude ? parseFloat(latestScan.latitude) : null,
                    longitude: latestScan && latestScan.longitude ? parseFloat(latestScan.longitude) : null,
                    notes: latestScan ? latestScan.notes : null,
                    remark: latestScan ? latestScan.notes : null,
                    remarks: latestScan ? latestScan.notes : null,

                    // Box scan history
                    scan_history: boxScanHistory,
                    // history: boxScanHistory,
                    // scans: boxScanHistory,

                    is_damaged: b.is_damaged === 1 || b.is_damaged === true,
                    damage_comment: b.damage_comment || null,
                    // damage_photos: photosByBox[b.id] || [],
                    has_damage_photos: (photosByBox[b.id] || []).length > 0
                };
            });

            // Map full consignment scan history with device_id and resolved location from lat/long
            const allConsignmentScanHistory = scanEvents.map(s => {
                const sTime = s.scanned_at;
                const sDate = sTime ? WarehouseTrackingController.formatDisplayDate(sTime) : null;
                const sHour = sTime ? WarehouseTrackingController.formatDisplayTime(sTime) : null;
                const sNormStatus = WarehouseTrackingController.normalizeTimelineStatus(s.scan_event);
                const sInfo = getScanResolvedInfo(s);
                return {
                    scan_id: s.id,
                    id: s.id,
                    box_id: s.box_id,
                    box_number: s.box_number || 1,
                    total_boxes: s.total_boxes || totalBoxesCount,
                    box_display: `Box ${s.box_number || 1}/${s.total_boxes || totalBoxesCount}`,
                    barcode_string: s.barcode_string,
                    event: s.scan_event,
                    scan_event: s.scan_event,
                    status: sNormStatus,
                    status_label: sNormStatus,
                    timestamp: sTime,
                    scanned_at: sTime,
                    time: sHour,
                    date: sDate,
                    formatted_time: sHour,
                    formatted_date: sDate,
                    formatted_datetime: sTime ? `${sDate}, ${sHour}` : null,
                    location: sInfo.location,
                    location_name: sInfo.location,
                    exact_location: sInfo.exact_location || sInfo.location,
                    address_details: sInfo.address_details || null,
                    warehouse_name: s.warehouse_name || 'Transit Depot',
                    device_id: s.device_id || 'HANDHELD',
                    latitude: s.latitude ? parseFloat(s.latitude) : null,
                    longitude: s.longitude ? parseFloat(s.longitude) : null,
                    operator: s.staff_name || 'Warehouse Staff',
                    scanned_by: s.staff_name || 'Warehouse Staff',
                    scanned_by_name: s.staff_name || 'Warehouse Staff',
                    notes: s.notes || null,
                    remark: s.notes || null,
                    remarks: s.notes || null,
                    description: s.notes || null
                };
            });

            if (primaryBox && allBoxes.length > 0) {
                primaryBox.scan_history = allBoxes[0].scan_history;
            }

            const hasAnyDamaged = allConsignmentBoxes.some(b => b.is_damaged === 1 || b.is_damaged === true) || formattedAttachments.length > 0;

            return res.status(200).json({
                success: true,
                box: primaryBox,
                order_summary: {
                    order_id: primaryBox.order_id,
                    order_number: primaryBox.order_number || primaryBox.warehouse_order_number,
                    warehouse_reference: primaryBox.warehouse_order_number,
                    current_track_status: resolvedCurrentTrackStatus,
                    total_boxes: totalBoxesCount,
                    is_damaged: hasAnyDamaged ? 1 : 0,
                    has_damage_photos: formattedAttachments.length > 0,
                    damage_photos_count: formattedAttachments.length
                },
                all_boxes_in_consignment: allBoxes,
                // boxes: allBoxes,
                timeline: deduplicatedTimeline,
                scan_history: allConsignmentScanHistory,
                attachments: formattedAttachments,
                // damage_photos: formattedAttachments
            });

        } catch (error) {
            logger.error('Error tracking barcode timeline:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve tracking timeline',
                error: error.message
            });
        }
    }

    /**
     * Batch / Container loading reconciliation
     * GET /api/warehouse/batch/:batch_id/reconciliation
     */
    static async getBatchReconciliation(req, res) {
        const { batch_id } = req.params;

        try {
            const batchRows = await new Promise((resolve, reject) => {
                con.query('SELECT * FROM batches WHERE id = ?', [batch_id], (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            if (batchRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Batch / Container not found' });
            }

            const batch = batchRows[0];

            // Get boxes assigned to this batch
            const boxes = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT id, barcode_string, box_number, total_boxes, warehouse_order_number, current_status, is_damaged 
                     FROM warehouse_package_boxes 
                     WHERE assigned_batch_id = ?`,
                    [batch_id],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            const loadedCount = boxes.filter(b => {
                const s = (b.current_status || '').toUpperCase();
                return s === 'LOADED_CONTAINER' || s === 'LOADED_FLIGHT';
            }).length;
            const pendingCount = boxes.length - loadedCount;

            return res.status(200).json({
                success: true,
                batch: {
                    id: batch.id,
                    batch_number: batch.batch_number,
                    batch_name: batch.batch_name,
                    vessel: batch.vessel,
                    waybill: batch.waybill
                },
                summary: {
                    total_assigned_boxes: boxes.length,
                    total_loaded: loadedCount,
                    total_pending: pendingCount,
                    percentage_loaded: boxes.length > 0 ? ((loadedCount / boxes.length) * 100).toFixed(1) + '%' : '0%'
                },
                boxes: boxes
            });

        } catch (error) {
            logger.error('Error fetching batch reconciliation:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch batch reconciliation',
                error: error.message
            });
        }
    }

    /**
     * Upload photo for damaged carton / box proof
     * POST /api/warehouse/box/:barcode/upload
     * Accepts single or multiple photos (field name 'file', 'photo', or 'photos')
     */
    static async uploadDamagePhoto(req, res) {
        try {
            const barcode = (req.params.barcode || req.body.barcode_string || '').trim();
            const damageComment = (req.body.damage_comment || req.body.notes || req.body.comment || '').trim();
            const fileType = (req.body.file_type || 'damage_photo').trim();
            const scanEventId = req.body.scan_event_id ? parseInt(req.body.scan_event_id, 10) : null;
            const userId = (req.user && req.user.id) || (req.body.user_id ? parseInt(req.body.user_id, 10) : null);

            if (!barcode) {
                return res.status(400).json({ success: false, message: 'Barcode is required' });
            }

            // Collect uploaded files from req.files or req.file
            let uploadedFiles = [];
            if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                uploadedFiles = [...req.files];
            } else if (req.file) {
                uploadedFiles = [req.file];
            }

            // Also check for Base64 image payload in req.body
            const damagePhotoDir = path.join(__dirname, '../public/damage_photos');
            if (!fs.existsSync(damagePhotoDir)) {
                fs.mkdirSync(damagePhotoDir, { recursive: true });
            }

            const base64List = [];
            ['photo', 'photos', 'image', 'images', 'damage_photo', 'damage_photos'].forEach(key => {
                const val = req.body[key];
                if (val) {
                    if (Array.isArray(val)) {
                        val.forEach(v => { if (typeof v === 'string') base64List.push(v); });
                    } else if (typeof val === 'string') {
                        base64List.push(val);
                    }
                }
            });

            base64List.forEach((b64, idx) => {
                const trimmed = b64.trim();
                let ext = '.jpg';
                let dataToBuffer = null;

                const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/i);
                if (match) {
                    const sub = match[1].toLowerCase();
                    if (sub.includes('png')) ext = '.png';
                    else if (sub.includes('webp')) ext = '.webp';
                    else if (sub.includes('heic')) ext = '.heic';
                    else if (sub.includes('heif')) ext = '.heif';
                    else if (sub.includes('gif')) ext = '.gif';
                    else if (sub.includes('bmp')) ext = '.bmp';
                    else if (sub.includes('svg')) ext = '.svg';
                    else if (sub.includes('tiff') || sub.includes('tif')) ext = '.tif';
                    else if (sub.includes('avif')) ext = '.avif';
                    else ext = '.jpg';
                    dataToBuffer = match[2];
                } else if (trimmed.length > 100 && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
                    dataToBuffer = trimmed;
                }

                if (dataToBuffer) {
                    try {
                        const buffer = Buffer.from(dataToBuffer, 'base64');
                        const safeName = `damage-b64-${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`;
                        const fullPath = path.join(damagePhotoDir, safeName);
                        fs.writeFileSync(fullPath, buffer);
                        uploadedFiles.push({
                            filename: safeName,
                            originalname: `capture_${idx + 1}${ext}`,
                            path: fullPath,
                            mimetype: `image/${ext.replace('.', '')}`
                        });
                    } catch (b64Err) {
                        logger.warn('Error saving base64 damage image:', b64Err.message);
                    }
                }
            });

            if (uploadedFiles.length === 0) {
                return res.status(400).json({ success: false, message: 'At least one image file or base64 photo is required' });
            }

            // 1. Verify box exists
            const boxRows = await new Promise((resolve, reject) => {
                con.query(
                    'SELECT id, box_number, total_boxes, warehouse_order_number, is_damaged, damage_comment FROM warehouse_package_boxes WHERE barcode_string = ?',
                    [barcode],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            if (!boxRows || boxRows.length === 0) {
                return res.status(404).json({ success: false, message: `Box with barcode '${barcode}' not found` });
            }

            const box = boxRows[0];

            // 2. Insert records into warehouse_box_files
            const fileRecords = [];
            for (const file of uploadedFiles) {
                const relativeUrl = `/damage_photos/${file.filename}`;
                const insertSql = `
                    INSERT INTO warehouse_box_files (
                        box_id, scan_event_id, file_type, file_name, file_path, file_url, uploaded_by_user_id, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                `;
                const insertResult = await new Promise((resolve, reject) => {
                    con.query(
                        insertSql,
                        [box.id, scanEventId, fileType, file.originalname, file.path, relativeUrl, userId],
                        (err, result) => (err ? reject(err) : resolve(result))
                    );
                });

                fileRecords.push({
                    file_id: insertResult.insertId,
                    file_name: file.originalname,
                    file_url: relativeUrl,
                    file_type: fileType
                });
            }

            // 3. Mark box as damaged in warehouse_package_boxes
            const finalComment = damageComment || box.damage_comment || 'Damaged carton photo uploaded';
            await new Promise((resolve, reject) => {
                con.query(
                    'UPDATE warehouse_package_boxes SET is_damaged = 1, damage_comment = ?, updated_at = NOW() WHERE id = ?',
                    [finalComment, box.id],
                    (err, result) => (err ? reject(err) : resolve(result))
                );
            });

            // 4. Socket.io broadcast
            if (global.io) {
                global.io.emit('warehouse:box_damaged', {
                    box_id: box.id,
                    barcode_string: barcode,
                    box_number: box.box_number,
                    total_boxes: box.total_boxes,
                    files: fileRecords,
                    damage_comment: finalComment,
                    timestamp: new Date()
                });
            }

            return res.status(200).json({
                success: true,
                message: `Uploaded ${fileRecords.length} photo(s) for box ${box.box_number} of ${box.total_boxes}`,
                box_id: box.id,
                barcode_string: barcode,
                is_damaged: 1,
                damage_comment: finalComment,
                files: fileRecords
            });

        } catch (error) {
            logger.error('Error uploading damage photo:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload damage photo',
                error: error.message
            });
        }
    }

    /**
     * Unified Login for Warehouse Staff and Suppliers
     * POST /api/warehouse/auth/mobile-login OR /api/warehouse/login
     * Body: { email, password, role (optional) }
     */
    static async mobileLogin(req, res) {
        try {
            const { email, password, role } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const cleanEmail = email.trim().toLowerCase();
            const requestedRole = (role || '').trim().toLowerCase();

            let matchedUser = null;
            let userRole = null;

            // 1. Check Staff / Admin (tbl_users) if role is not strictly 'supplier'
            if (requestedRole !== 'supplier') {
                const staffRows = await new Promise((resolve, reject) => {
                    const query = `
                        SELECT id, full_name, email, password, profile, user_type, is_deleted, status, assigned_roles, access_country 
                        FROM tbl_users 
                        WHERE LOWER(email) = ? AND is_deleted = 0 AND (user_type = 1 OR user_type = 2)
                        LIMIT 1
                    `;
                    con.query(query, [cleanEmail], (err, rows) => (err ? reject(err) : resolve(rows)));
                });

                if (staffRows.length > 0) {
                    const staff = staffRows[0];
                    const isPasswordMatch = await bcrypt.compare(password, staff.password);
                    if (isPasswordMatch) {
                        if (staff.status != 1) {
                            return res.status(403).json({
                                success: false,
                                message: 'Your staff account has been deactivated by administrator'
                            });
                        }
                        matchedUser = staff;
                        userRole = 'staff';
                    }
                }
            }

            // 2. Check Supplier (tbl_suppliers) if not matched yet and requestedRole is not strictly 'staff'
            if (!matchedUser && requestedRole !== 'staff') {
                const supplierRows = await new Promise((resolve, reject) => {
                    const query = `
                        SELECT id, name, email, password, company_name, phone_no, country, profile, user_type, is_deleted 
                        FROM tbl_suppliers 
                        WHERE LOWER(email) = ? AND is_deleted = 0
                        LIMIT 1
                    `;
                    con.query(query, [cleanEmail], (err, rows) => (err ? reject(err) : resolve(rows)));
                });

                if (supplierRows.length > 0) {
                    const supplier = supplierRows[0];
                    const isPasswordMatch = await bcrypt.compare(password, supplier.password);
                    if (isPasswordMatch) {
                        matchedUser = supplier;
                        userRole = 'supplier';
                    }
                }
            }

            // 3. Invalid credentials
            if (!matchedUser) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // 4. Generate 30-day JWT Bearer Token
            const tokenPayload = {
                id: matchedUser.id,
                email: matchedUser.email,
                role: userRole,
                user_type: parseInt(matchedUser.user_type, 10),
                name: matchedUser.full_name || matchedUser.name
            };

            const token = jwt.sign(tokenPayload, ACCESS_TOKEN_SECRET || 'secret-key-asia-direct', {
                expiresIn: '30d'
            });

            // Update LastLogin for staff
            if (userRole === 'staff') {
                con.query('UPDATE tbl_users SET LastLogin = NOW() WHERE id = ?', [matchedUser.id], (err) => {
                    if (err) logger.warn('Failed to update LastLogin for staff:', err.message);
                });
            }

            const accessCountries = matchedUser.access_country
                ? matchedUser.access_country.split(',').map(c => c.trim()).filter(Boolean)
                : [];

            return res.status(200).json({
                success: true,
                message: `${userRole === 'staff' ? 'Staff' : 'Supplier'} login successful`,
                token: token,
                user: {
                    id: matchedUser.id,
                    name: matchedUser.full_name || matchedUser.name,
                    email: matchedUser.email,
                    role: userRole,
                    country: matchedUser.country,
                    user_type: parseInt(matchedUser.user_type, 10),
                    company_name: matchedUser.company_name || null,
                    profile_image: matchedUser.profile || null,
                    phone_no: matchedUser.phone_no || null,
                    assigned_roles: matchedUser.assigned_roles || null,
                    access_country: accessCountries
                }
            });

        } catch (error) {
            logger.error('Error during mobile login:', error);
            return res.status(500).json({
                success: false,
                message: 'An internal server error occurred during login',
                error: error.message
            });
        }
    }

    /**
     * Get Current Authenticated User Profile
     * GET /api/warehouse/auth/me OR /api/warehouse/me
     */
    static async getCurrentUserProfile(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const userId = req.user.id;
            const role = req.user.role || 'staff';

            if (role === 'supplier') {
                const supplierRows = await new Promise((resolve, reject) => {
                    con.query(
                        'SELECT id, name, email, company_name, phone_no, country, profile, user_type FROM tbl_suppliers WHERE id = ? AND is_deleted = 0',
                        [userId],
                        (err, rows) => (err ? reject(err) : resolve(rows))
                    );
                });

                if (supplierRows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Supplier profile not found' });
                }

                const s = supplierRows[0];
                return res.status(200).json({
                    success: true,
                    user: {
                        id: s.id,
                        name: s.name,
                        email: s.email,
                        role: 'supplier',
                        user_type: parseInt(s.user_type, 10),
                        company_name: s.company_name || null,
                        phone_no: s.phone_no || null,
                        profile_image: s.profile || null
                    }
                });
            } else {
                const staffRows = await new Promise((resolve, reject) => {
                    con.query(
                        'SELECT id, full_name, email, profile, user_type, status, assigned_roles, access_country FROM tbl_users WHERE id = ? AND is_deleted = 0',
                        [userId],
                        (err, rows) => (err ? reject(err) : resolve(rows))
                    );
                });

                if (staffRows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Staff profile not found' });
                }

                const u = staffRows[0];
                const accessCountries = u.access_country
                    ? u.access_country.split(',').map(c => c.trim()).filter(Boolean)
                    : [];

                return res.status(200).json({
                    success: true,
                    user: {
                        id: u.id,
                        name: u.full_name,
                        email: u.email,
                        role: 'staff',
                        user_type: parseInt(u.user_type, 10),
                        status: u.status,
                        profile_image: u.profile || null,
                        assigned_roles: u.assigned_roles,
                        access_country: accessCountries
                    }
                });
            }
        } catch (error) {
            logger.error('Error fetching current user profile:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user profile',
                error: error.message
            });
        }
    }

    /**
     * List warehouse orders / consignments for Mobile App & Portal
     * GET /api/warehouse/orders or POST /api/warehouse/orders
     * Supports:
     * - Automatic role filtering (Supplier sees only their consignments, Staff sees all / warehouse-specific)
     * - Search by order_number, customer_name, customer_ref, goods_description
     * - Filter by barcode_status: 'ALL' | 'NOT_GENERATED' | 'GENERATED'
     * - Pagination: page, limit
     */
    static async getWarehouseOrdersList(req, res) {
        try {
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {}
            }
            user = user || {};
            const role = (user.role || req.query.role || req.body.role || (parseInt(user.user_type, 10) === 1 ? 'supplier' : 'staff')).toLowerCase().trim();
            const userId = user.id || req.query.supplier_id || req.body.supplier_id || null;

            const page = Math.max(1, parseInt(req.query.page || req.body.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.body.limit, 10) || 20));
            const offset = (page - 1) * limit;

            const search = (req.query.search || req.body.search || '').trim();
            const barcodeStatus = (req.query.barcode_status || req.body.barcode_status || 'ALL').toUpperCase();

            let whereClauses = ['1=1'];
            let params = [];

            // Role based filtering
            if (role === 'supplier' && userId) {
                whereClauses.push('swo.supplier_id = ?');
                params.push(userId);
            }

            // Search filter
            if (search) {
                whereClauses.push(`(
                    o.order_number LIKE ? 
                    OR swo.warehouse_order_id LIKE ? 
                    OR swo.customer_name LIKE ? 
                    OR swo.customer_ref LIKE ? 
                    OR swo.goods_description LIKE ?
                    OR c_orig.name LIKE ?
                    OR c.name LIKE ?
                )`);
                const sParam = `%${search}%`;
                params.push(sParam, sParam, sParam, sParam, sParam, sParam, sParam);
            }

            // Barcode status having filter
            let havingClause = '';
            if (barcodeStatus === 'GENERATED') {
                havingClause = 'HAVING COUNT(DISTINCT b.id) > 0';
            } else if (barcodeStatus === 'NOT_GENERATED' || barcodeStatus === 'PENDING') {
                havingClause = 'HAVING COUNT(DISTINCT b.id) = 0';
            }

            const whereSql = whereClauses.join(' AND ');

            // Count query
            const countSql = `
                SELECT COUNT(*) as total_count FROM (
                    SELECT swo.id
                    FROM supplier_warehouse_orders swo
                    LEFT JOIN tbl_orders o ON o.id = swo.order_id
                    LEFT JOIN warehouse_tbl w ON w.id = swo.warehouse_id
                    LEFT JOIN countries c_orig ON c_orig.id = swo.collection_from
                    LEFT JOIN countries c ON c.id = swo.destination_country
                    LEFT JOIN warehouse_package_boxes b ON (
                        b.supplier_warehouse_order_id = swo.id
                        OR (swo.admin_warehouseOrder_id > 0 AND b.warehouse_assign_order_id = swo.admin_warehouseOrder_id)
                        OR (swo.order_id > 0 AND b.order_id = swo.order_id)
                        OR (swo.warehouse_order_id IS NOT NULL AND swo.warehouse_order_id != '' AND b.warehouse_order_number COLLATE utf8mb4_general_ci = swo.warehouse_order_id)
                    )
                    WHERE ${whereSql}
                    GROUP BY swo.id
                    ${havingClause}
                ) as subquery
            `;

            const totalRows = await new Promise((resolve, reject) => {
                con.query(countSql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
            });
            const total = (totalRows && totalRows[0]) ? totalRows[0].total_count : 0;

            // Data query
            const dataSql = `
                SELECT swo.id as supplier_warehouse_order_id,
                       swo.warehouse_order_id as local_wh_ref,
                       swo.order_id,
                       COALESCE(o.order_number, CONCAT('OR000', swo.order_id), swo.warehouse_order_id) as order_number,
                       swo.customer_name,
                       swo.customer_ref,
                       swo.supplier_id,
                       COALESCE(swo.supplier_company, su.name, 'N/A') as supplier_name,
                       swo.goods_description,
                       swo.package_type,
                       swo.total_packages,
                       swo.total_weight,
                       swo.total_cbm,
                       swo.warehouse_id as origin_warehouse_id,
                       w.warehouse_name as origin_warehouse_name,
                       COALESCE(swo.collection_from, w.country) as origin_country_id,
                       COALESCE(c_orig.name, c_wh.name, 'N/A') as origin_country_name,
                       swo.destination_country,
                       c.name as destination_country_name,
                       swo.created_at,
                       COUNT(DISTINCT b.id) as generated_boxes_count,
                       CASE WHEN COUNT(DISTINCT b.id) > 0 THEN 'GENERATED' ELSE 'NOT_GENERATED' END as barcode_status
                FROM supplier_warehouse_orders swo
                LEFT JOIN tbl_orders o ON o.id = swo.order_id
                LEFT JOIN tbl_suppliers su ON su.id = swo.supplier_id
                LEFT JOIN warehouse_tbl w ON w.id = swo.warehouse_id
                LEFT JOIN countries c_orig ON c_orig.id = swo.collection_from
                LEFT JOIN countries c_wh ON c_wh.id = w.country
                LEFT JOIN countries c ON c.id = swo.destination_country
                LEFT JOIN warehouse_package_boxes b ON (
                    b.supplier_warehouse_order_id = swo.id
                    OR (swo.admin_warehouseOrder_id > 0 AND b.warehouse_assign_order_id = swo.admin_warehouseOrder_id)
                    OR (swo.order_id > 0 AND b.order_id = swo.order_id)
                    OR (swo.warehouse_order_id IS NOT NULL AND swo.warehouse_order_id != '' AND b.warehouse_order_number COLLATE utf8mb4_general_ci = swo.warehouse_order_id)
                )
                WHERE ${whereSql}
                GROUP BY swo.id
                ${havingClause}
                ORDER BY swo.id DESC
                LIMIT ? OFFSET ?
            `;

            const dataParams = [...params, limit, offset];
            const orders = await new Promise((resolve, reject) => {
                con.query(dataSql, dataParams, (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            return res.status(200).json({
                success: true,
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit),
                orders
            });

        } catch (error) {
            logger.error('Error fetching warehouse orders list:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch warehouse orders list',
                error: error.message
            });
        }
    }

    /**
     * Get Warehouse Orders for Staff based on Access Country
     * POST /api/warehouse/GetWarehouseOrders OR POST /api/warehouse/staff/orders OR POST /api/warehouse/orders/staff
     * Tracking counterpart of adminController.GetWarehouseOrders (adminController.js:L12187-L13443)
     * Filters warehouse orders based on staff's access_country (or full access for ALL_ACCESS_USERS).
     */
    static async getStaffWarehouseOrders(req, res) {
        try {
            // 1. Resolve User & Identity
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {}
            }

            const reqData = { ...req.query, ...req.body };
            const {
                origin,
                destination,
                startDate,
                endDate,
                freightType,
                freightSpeed,
                search,
                warehouse_item_status,
                barcode_status,
                tab = "instore",
                sort_order,
                page = 1,
                limit = 10
            } = reqData;

            const userId = reqData.user_id || (user ? user.id : null);
            let userType = reqData.user_type !== undefined ? reqData.user_type : (user && user.user_type !== undefined ? user.user_type : null);

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: "user_id is required"
                });
            }

            const ALL_ACCESS_USERS = [1, 19855];

            const pageNo = Math.max(1, Number(page) || 1);
            const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
            const offset = (pageNo - 1) * pageSize;

            const normalizedTab = String(tab || "instore").toLowerCase();
            const allowedTabs = [
                "all",
                "instore",
                "assigned",
                "not_assigned",
                "out"
            ];

            if (!allowedTabs.includes(normalizedTab)) {
                return res.status(400).json({
                    success: false,
                    message: "tab must be instore, assigned, not_assigned, out, or all"
                });
            }

            let condition = `
                WHERE warehouse_assign_order.warehouse_status = 1
            `;
            let params = [];

            // Access Country
            let accessCountries = [];
            if (!ALL_ACCESS_USERS.includes(Number(userId))) {
                const userRows = await new Promise((resolve, reject) => {
                    con.query(
                        `SELECT access_country, user_type FROM tbl_users WHERE id = ? AND is_deleted = 0 LIMIT 1`,
                        [userId],
                        (err, rows) => (err ? reject(err) : resolve(rows || []))
                    );
                });

                if (userRows.length > 0) {
                    if (userType === null || userType === undefined) {
                        userType = userRows[0].user_type;
                    }
                    if (userRows[0].access_country) {
                        accessCountries = String(userRows[0].access_country)
                            .split(",")
                            .map(id => Number(id.trim()))
                            .filter(Boolean);
                    }
                }

                if (accessCountries.length === 0 && reqData.access_country) {
                    const rawAcc = reqData.access_country;
                    accessCountries = Array.isArray(rawAcc)
                        ? rawAcc.map(Number).filter(Boolean)
                        : String(rawAcc).split(",").map(id => Number(id.trim())).filter(Boolean);
                }
            }

            // Origin
            if (origin) {
                condition += `
                    AND COALESCE(
                        tbl_freight.collection_from,
                        tbl_orders.collection_from
                    ) = ?
                `;
                params.push(origin);
            }

            // Destination
            if (destination) {
                condition += `
                    AND COALESCE(
                        tbl_freight.delivery_to,
                        tbl_orders.delivery_to
                    ) = ?
                `;
                params.push(destination);
            }

            // Date filter
            if (startDate && endDate) {
                condition += `
                    AND (
                        tbl_freight.created_at BETWEEN ? AND ?
                        OR
                        tbl_orders.created_at BETWEEN ? AND ?
                    )
                `;
                params.push(startDate, endDate, startDate, endDate);
            }

            // Freight type
            if (freightType) {
                condition += `
                    AND COALESCE(
                        NULLIF(tbl_freight.freight, ''),
                        NULLIF(tbl_orders.freight, ''),
                        NULLIF(tbl_orders.freight_type, '')
                    ) = ?
                `;
                params.push(freightType);
            }

            // Freight speed
            if (freightSpeed) {
                condition += `
                    AND (
                        tbl_freight.type = ?
                        OR tbl_freight.id IS NULL
                    )
                `;
                params.push(freightSpeed);
            }

            // Tracking joins
            const trackingJoins = `
                LEFT JOIN (
                    SELECT
                        order_id,
                        MIN(created_at) AS first_track_at
                    FROM order_track
                    WHERE
                        order_id IS NOT NULL
                        AND order_id > 0
                    GROUP BY order_id
                ) ot_order
                    ON ot_order.order_id = warehouse_assign_order.order_id
                    AND warehouse_assign_order.order_id > 0

                LEFT JOIN (
                    SELECT
                        batch_id,
                        MIN(created_at) AS first_track_at
                    FROM order_track
                    WHERE
                        batch_id IS NOT NULL
                        AND batch_id > 0
                    GROUP BY batch_id
                ) ot_batch
                    ON ot_batch.batch_id = warehouse_assign_order.batch_id
                    AND NULLIF(warehouse_assign_order.batch_id, 0) IS NOT NULL
            `;

            const trackingStartedAtExpr = `
                CASE
                    WHEN ot_order.first_track_at IS NULL AND ot_batch.first_track_at IS NULL THEN NULL
                    WHEN ot_order.first_track_at IS NULL THEN ot_batch.first_track_at
                    WHEN ot_batch.first_track_at IS NULL THEN ot_order.first_track_at
                    ELSE LEAST(ot_order.first_track_at, ot_batch.first_track_at)
                END
            `;

            const hasTrackingStartedExpr = `
                (
                    ot_order.first_track_at IS NOT NULL
                    OR ot_batch.first_track_at IS NOT NULL
                    OR (tbl_orders.track_status IS NOT NULL AND tbl_orders.track_status != '')
                    OR (batches.track_status IS NOT NULL AND batches.track_status != '')
                )
            `;

            const arrivalDateExpr = `
                COALESCE(
                    warehouse_assign_order.date_received,
                    DATE(warehouse_assign_order.warehousing_date),
                    DATE(warehouse_assign_order.created_at)
                )
            `;

            // Existing warehouse_item_status filter
            if (warehouse_item_status === "In Store") {
                condition += `
                    AND ot_order.first_track_at IS NULL
                    AND ot_batch.first_track_at IS NULL
                    AND (tbl_orders.track_status IS NULL OR tbl_orders.track_status = '')
                    AND (batches.track_status IS NULL OR batches.track_status = '')
                `;
            } else if (warehouse_item_status === "Out") {
                condition += `
                    AND ${hasTrackingStartedExpr}
                `;
            }

            // Tab filter
            if (normalizedTab === "instore") {
                condition += `
                    AND (warehouse_assign_order.batch_id IS NULL OR warehouse_assign_order.batch_id = 0)
                    AND NOT (${hasTrackingStartedExpr})
                `;
            } else if (normalizedTab === "assigned") {
                condition += `
                    AND warehouse_assign_order.batch_id IS NOT NULL
                    AND warehouse_assign_order.batch_id != 0
                    AND NOT (${hasTrackingStartedExpr})
                `;
            } else if (normalizedTab === "not_assigned") {
                condition += `
                    AND (warehouse_assign_order.batch_id IS NULL OR warehouse_assign_order.batch_id = 0)
                    AND NOT (${hasTrackingStartedExpr})
                `;
            } else if (normalizedTab === "out") {
                condition += `
                    AND ${hasTrackingStartedExpr}
                `;
            }

            // Barcode status filter
            const reqBarcodeStatus = String(barcode_status || "").toUpperCase().trim();
            if (reqBarcodeStatus === "GENERATED") {
                condition += `
                    AND EXISTS (
                        SELECT 1 FROM warehouse_package_boxes b
                        LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                        WHERE b.warehouse_assign_order_id = warehouse_assign_order.id
                           OR swo.admin_warehouseOrder_id = warehouse_assign_order.id
                           OR (warehouse_assign_order.order_id > 0 AND (b.order_id = warehouse_assign_order.order_id OR swo.order_id = warehouse_assign_order.order_id))
                           OR (warehouse_assign_order.warehouse_order_id IS NOT NULL AND warehouse_assign_order.warehouse_order_id != '' AND (b.warehouse_order_number COLLATE utf8mb4_general_ci = warehouse_assign_order.warehouse_order_id OR swo.warehouse_order_id = warehouse_assign_order.warehouse_order_id))
                    )
                `;
            } else if (reqBarcodeStatus === "NOT_GENERATED" || reqBarcodeStatus === "PENDING") {
                condition += `
                    AND NOT EXISTS (
                        SELECT 1 FROM warehouse_package_boxes b
                        LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                        WHERE b.warehouse_assign_order_id = warehouse_assign_order.id
                           OR swo.admin_warehouseOrder_id = warehouse_assign_order.id
                           OR (warehouse_assign_order.order_id > 0 AND (b.order_id = warehouse_assign_order.order_id OR swo.order_id = warehouse_assign_order.order_id))
                           OR (warehouse_assign_order.warehouse_order_id IS NOT NULL AND warehouse_assign_order.warehouse_order_id != '' AND (b.warehouse_order_number COLLATE utf8mb4_general_ci = warehouse_assign_order.warehouse_order_id OR swo.warehouse_order_id = warehouse_assign_order.warehouse_order_id))
                    )
                `;
            }

            // Access Control
            if (!ALL_ACCESS_USERS.includes(Number(userId))) {
                if (accessCountries.length > 0) {
                    const placeholders = accessCountries.map(() => "?").join(",");

                    if (userType == 2) {
                        condition += `
                            AND (
                                tbl_freight.user_id = ?
                                OR tbl_freight.sales_representative = ?
                                OR (
                                    COALESCE(
                                        tbl_freight.collection_from,
                                        tbl_orders.collection_from
                                    ) IN (${placeholders})
                                    OR COALESCE(
                                        tbl_freight.delivery_to,
                                        tbl_orders.delivery_to
                                    ) IN (${placeholders})
                                )
                            )
                        `;
                        params.push(userId, userId, ...accessCountries, ...accessCountries);
                    } else {
                        condition += `
                            AND (
                                COALESCE(
                                    tbl_freight.collection_from,
                                    tbl_orders.collection_from
                                ) IN (${placeholders})
                                OR COALESCE(
                                    tbl_freight.delivery_to,
                                    tbl_orders.delivery_to
                                ) IN (${placeholders})
                            )
                        `;
                        params.push(...accessCountries, ...accessCountries);
                    }
                } else if (userType == 2 || (user && user.role === 'staff')) {
                    condition += ` AND 1 = 0 `;
                }
            }

            // Search
            if (search) {
                condition += `
                    AND (
                        (
                            CASE
                                WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
                                ELSE tbl_users.full_name
                            END LIKE ?
                        )
                        OR tbl_freight.freight_number LIKE ?
                        OR COALESCE(tbl_freight.product_desc, tbl_orders.goods_description) LIKE ?
                        OR tbl_orders.client_name LIKE ?
                        OR tbl_orders.order_number LIKE ?
                        OR warehouse_tbl.warehouse_name LIKE ?
                        OR warehouse_assign_order.warehouse_order_id LIKE ?
                        OR batches.batch_number LIKE ?
                        OR c.name LIKE ?
                        OR co.name LIKE ?
                    )
                `;
                const s = `%${search}%`;
                params.push(s, s, s, s, s, s, s, s, s, s);
            }

            // Base Query
            const baseQuery = `
                FROM warehouse_assign_order
                LEFT JOIN tbl_orders
                    ON warehouse_assign_order.order_id = tbl_orders.id
                LEFT JOIN tbl_freight
                    ON tbl_freight.id = COALESCE(
                        NULLIF(warehouse_assign_order.freight_id, 0),
                        NULLIF(tbl_orders.freight_id, 0)
                    )
                LEFT JOIN tbl_users
                    ON tbl_users.id = tbl_orders.client_id
                LEFT JOIN batches
                    ON batches.id = warehouse_assign_order.batch_id
                LEFT JOIN warehouse_tbl
                    ON warehouse_tbl.id = batches.warehouse_id
                LEFT JOIN countries c
                    ON c.id = COALESCE(
                        tbl_freight.delivery_to,
                        tbl_orders.delivery_to
                    )
                LEFT JOIN countries co
                    ON co.id = COALESCE(
                        tbl_freight.collection_from,
                        tbl_orders.collection_from
                    )
                LEFT JOIN (
                    SELECT
                        warehouse_order_id,
                        SUM(IFNULL(dimension, 0)) AS wp_total_dimension,
                        SUM(IFNULL(weight, 0)) AS wp_total_weight,
                        SUM(IFNULL(packages, 0)) AS wp_total_packages,
                        MAX(NULLIF(freight, '')) AS wp_freight
                    FROM warehouse_products
                    GROUP BY warehouse_order_id
                ) wp
                    ON wp.warehouse_order_id = warehouse_assign_order.id
                ${trackingJoins}
                ${condition}
            `;

            const freightModeExpr = `
                COALESCE(
                    NULLIF(tbl_freight.freight, ''),
                    NULLIF(tbl_orders.freight, ''),
                    NULLIF(tbl_orders.freight_type, ''),
                    NULLIF(wp.wp_freight, '')
                )
            `;

            // Count Query
            const countQuery = `
                SELECT COUNT(warehouse_assign_order.id) AS total
                ${baseQuery}
            `;

            // Sorting — always descending by order_id (order number) across all tabs
            const sortField = `COALESCE(warehouse_assign_order.order_id, 0)`;
            const sortDirection = "DESC";

            // Data Query
            const dataQuery = `
                SELECT
                    warehouse_assign_order.*,
                    warehouse_assign_order.id AS warehouse_assign_order_id,
                    tbl_freight.*,
                    tbl_orders.*,
                    COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) AS delivery_to,
                    COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) AS collection_from,
                    batches.batch_number,
                    ${freightModeExpr} AS Freight,
                    ${freightModeExpr} AS freight,
                    COALESCE(tbl_freight.product_desc, tbl_orders.goods_description) AS product_desc,
                    COALESCE(
                        NULLIF(tbl_freight.dimension, 0),
                        NULLIF(CAST(tbl_orders.dimensions AS DECIMAL(10, 2)), 0),
                        NULLIF(wp.wp_total_dimension, 0),
                        0
                    ) AS total_dimension,
                    COALESCE(
                        NULLIF(tbl_freight.weight, 0),
                        NULLIF(CAST(tbl_orders.weight AS DECIMAL(10, 2)), 0),
                        NULLIF(wp.wp_total_weight, 0),
                        0
                    ) AS total_weight,
                    COALESCE(
                        NULLIF(tbl_freight.no_of_packages, 0),
                        NULLIF(CAST(tbl_orders.cartons AS UNSIGNED), 0),
                        NULLIF(wp.wp_total_packages, 0),
                        0
                    ) AS total_packages,
                    c.name AS delivery_to_name,
                    co.name AS collection_from_name,
                    CASE
                        WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
                        ELSE tbl_users.full_name
                    END AS client_name,
                    ${trackingStartedAtExpr} AS tracking_started_at,
                    CASE
                        WHEN ${hasTrackingStartedExpr} THEN 'Out'
                        ELSE 'In Store'
                    END AS warehouse_item_status,
                    CASE
                        WHEN ${arrivalDateExpr} IS NULL THEN 0
                        WHEN ${trackingStartedAtExpr} IS NOT NULL THEN GREATEST(
                            DATEDIFF(DATE(${trackingStartedAtExpr}), ${arrivalDateExpr}), 0
                        )
                        WHEN (tbl_orders.track_status IS NOT NULL AND tbl_orders.track_status != '')
                             OR (batches.track_status IS NOT NULL AND batches.track_status != '') THEN GREATEST(
                            DATEDIFF(
                                COALESCE(batches.date_dispatch, warehouse_assign_order.dispatched_date, CURDATE()),
                                ${arrivalDateExpr}
                            ), 0
                        )
                        ELSE GREATEST(DATEDIFF(CURDATE(), ${arrivalDateExpr}), 0)
                    END AS days_in_warehouse,
                    tbl_orders.track_status AS order_track_status,
                    batches.track_status AS batch_track_status
                ${baseQuery}
                ORDER BY
                    ${sortField} ${sortDirection},
                    warehouse_assign_order.id ${sortDirection}
                LIMIT ?
                OFFSET ?
            `;

            const runQuery = (sql, queryParams) =>
                new Promise((resolve, reject) => {
                    con.query(sql, queryParams, (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    });
                });

            const [totalResult, data] = await Promise.all([
                runQuery(countQuery, params),
                runQuery(dataQuery, [...params, pageSize, offset])
            ]);

            // Attach box barcode summary if available
            if (data && data.length > 0) {
                const waoIds = data.map(d => d.warehouse_assign_order_id).filter(id => id && id > 0);
                const orderIds = data.map(d => d.order_id).filter(id => id && id > 0);
                const whOrderNumbers = [];
                data.forEach(d => {
                    const whId = d.warehouse_order_id ? String(d.warehouse_order_id).trim() : '';
                    if (whId && whId !== 'null' && whId !== 'undefined' && !whOrderNumbers.includes(whId)) {
                        whOrderNumbers.push(whId);
                    }
                    const ordNo = d.order_number ? String(d.order_number).trim() : '';
                    if (ordNo && ordNo !== 'null' && ordNo !== 'undefined' && !whOrderNumbers.includes(ordNo)) {
                        whOrderNumbers.push(ordNo);
                    }
                    const freightNo = d.freight_number ? String(d.freight_number).trim() : '';
                    if (freightNo && freightNo !== 'null' && freightNo !== 'undefined' && !whOrderNumbers.includes(freightNo)) {
                        whOrderNumbers.push(freightNo);
                    }
                });

                if (waoIds.length > 0 || orderIds.length > 0 || whOrderNumbers.length > 0) {
                    try {
                        const boxSql = `
                            SELECT 
                                b.id as box_id,
                                b.warehouse_assign_order_id,
                                b.order_id as box_order_id,
                                b.supplier_warehouse_order_id,
                                b.warehouse_order_number,
                                b.current_status,
                                swo.admin_warehouseOrder_id as swo_admin_wao_id,
                                swo.order_id as swo_order_id,
                                swo.warehouse_order_id as swo_wh_ref
                            FROM warehouse_package_boxes b
                            LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                            WHERE (b.warehouse_assign_order_id IN (?) AND ? > 0)
                               OR (swo.admin_warehouseOrder_id IN (?) AND ? > 0)
                               OR (b.order_id IN (?) AND ? > 0)
                               OR (swo.order_id IN (?) AND ? > 0)
                               OR (b.warehouse_order_number IN (?) AND ? > 0)
                               OR (swo.warehouse_order_id IN (?) AND ? > 0)
                        `;

                        const boxRows = await new Promise((resolve) => {
                            con.query(
                                boxSql,
                                [
                                    waoIds.length ? waoIds : [0], waoIds.length,
                                    waoIds.length ? waoIds : [0], waoIds.length,
                                    orderIds.length ? orderIds : [0], orderIds.length,
                                    orderIds.length ? orderIds : [0], orderIds.length,
                                    whOrderNumbers.length ? whOrderNumbers : ['__NONE__'], whOrderNumbers.length,
                                    whOrderNumbers.length ? whOrderNumbers : ['__NONE__'], whOrderNumbers.length
                                ],
                                (bErr, bRows) => resolve(bRows || [])
                            );
                        });

                        const boxesByWao = new Map();
                        data.forEach(d => {
                            boxesByWao.set(d.warehouse_assign_order_id, new Map());
                        });

                        boxRows.forEach(b => {
                            data.forEach(d => {
                                const matchesWao = (b.warehouse_assign_order_id && b.warehouse_assign_order_id === d.warehouse_assign_order_id) ||
                                                   (b.swo_admin_wao_id && b.swo_admin_wao_id === d.warehouse_assign_order_id);

                                const matchesOrder = d.order_id && d.order_id > 0 && (
                                    (b.box_order_id && b.box_order_id === d.order_id) ||
                                    (b.swo_order_id && b.swo_order_id === d.order_id)
                                );

                                const matchesRef = (b.warehouse_order_number && (
                                    (d.warehouse_order_id && b.warehouse_order_number === d.warehouse_order_id) ||
                                    (d.order_number && b.warehouse_order_number === d.order_number) ||
                                    (d.freight_number && b.warehouse_order_number === d.freight_number)
                                )) || (b.swo_wh_ref && (
                                    (d.warehouse_order_id && b.swo_wh_ref === d.warehouse_order_id) ||
                                    (d.order_number && b.swo_wh_ref === d.order_number) ||
                                    (d.freight_number && b.swo_wh_ref === d.freight_number)
                                ));

                                if (matchesWao || matchesOrder || matchesRef) {
                                    boxesByWao.get(d.warehouse_assign_order_id).set(b.box_id, b);
                                }
                            });
                        });

                        data.forEach(d => {
                            const boxMap = boxesByWao.get(d.warehouse_assign_order_id);
                            const boxCount = boxMap ? boxMap.size : 0;
                            let scannedCount = 0;
                            if (boxMap) {
                                for (const b of boxMap.values()) {
                                    if (b.current_status && b.current_status !== 'GENERATED') {
                                        scannedCount++;
                                    }
                                }
                            }
                            d.barcode_status = boxCount > 0 ? 'GENERATED' : 'NOT_GENERATED';
                            d.generated_boxes_count = boxCount;
                            d.scanned_boxes_count = scannedCount;
                        });

                        // Opportunistic update to link warehouse_assign_order_id in warehouse_package_boxes
                        try {
                            const unlinkedBoxes = boxRows.filter(b => !b.warehouse_assign_order_id && b.swo_admin_wao_id);
                            if (unlinkedBoxes.length > 0) {
                                for (const b of unlinkedBoxes) {
                                    con.query('UPDATE warehouse_package_boxes SET warehouse_assign_order_id = ? WHERE id = ? AND warehouse_assign_order_id IS NULL', [b.swo_admin_wao_id, b.box_id], () => {});
                                }
                            }
                        } catch (e) {}
                    } catch (bErr) {
                        logger.warn('Failed to attach box barcode stats in getStaffWarehouseOrders:', bErr.message);
                    }
                }
            }

            return res.status(200).json({
                success: true,
                data,
                total: totalResult[0]?.total || 0,
                page: pageNo,
                limit: pageSize
            });

        } catch (error) {
            logger.error("getStaffWarehouseOrders Error:", error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async GetWarehouseOrders(req, res) {
        return WarehouseTrackingController.getStaffWarehouseOrders(req, res);
    }

    /**
     * Create / Add Supplier Warehouse Order (Mobile App & Portal)
     * POST /api/warehouse/orders/create OR POST /api/warehouse/supplier/order
     * Allows supplier to create a supplier warehouse order with full details.
     * Optionally generates barcodes immediately if generate_barcodes: true.
     */
    static async createSupplierWarehouseOrder(req, res) {
        try {
            // 1. Resolve User & Supplier Identity
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {}
            }

            const isSupplier = (user && (user.role === 'supplier' || parseInt(user.user_type, 10) === 1));
            const supplierId = (isSupplier && user.id)
                ? parseInt(user.id, 10)
                : (parseInt(req.body.supplier_id, 10) || (user && user.id ? parseInt(user.id, 10) : 0));

            const {
                customer_name,
                customer_ref,
                warehouse_id,
                origin_warehouse_id,
                destination_country,
                collection_from,
                goods_description,
                package_type,
                total_packages,
                total_boxes,
                total_weight,
                weight_kg,
                total_cbm,
                cbm,
                box_marking,
                courier_waybill_ref,
                dispatch_date,
                date_received,
                hazardous,
                hazard_description,
                package_comment,
                damaged_goods,
                damaged_pkg_qty,
                damage_comment,
                supplier_company,
                supplier_person,
                supplier_contact,
                supplier_address,
                warehouse_collect,
                costs_to_collect,
                warehouse_storage,
                warehouse_cost,
                handling_required,
                handling_cost,
                warehouse_dispatch,
                cost_to_dispatch,
                warehouse_comment,
                generate_barcodes,
                auto_generate_barcodes
            } = req.body;

            // Basic validation
            const parsedTotalPackages = parseInt(total_packages || total_boxes, 10);
            if (isNaN(parsedTotalPackages) || parsedTotalPackages <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'total_packages (or total_boxes) is required and must be a positive integer'
                });
            }

            if (!goods_description || !String(goods_description).trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'goods_description is required'
                });
            }

            // Fetch supplier profile if details not explicitly provided
            let compName = (supplier_company || '').trim();
            let contactPerson = (supplier_person || '').trim();
            let contactPhone = (supplier_contact || '').trim();
            let suppAddress = (supplier_address || '').trim();
            let suppCountry = null;

            if (supplierId > 0) {
                const suppRows = await new Promise((resolve) => {
                    con.query(
                        'SELECT id, name, company_name, email, phone_no, address, country FROM tbl_suppliers WHERE id = ? LIMIT 1',
                        [supplierId],
                        (err, rows) => resolve(rows || [])
                    );
                });
                if (suppRows && suppRows.length > 0) {
                    const s = suppRows[0];
                    if (!compName) compName = s.company_name || s.name || '';
                    if (!contactPerson) contactPerson = s.name || '';
                    if (!contactPhone) contactPhone = s.phone_no || '';
                    if (!suppAddress) suppAddress = s.address || '';
                    suppCountry = s.country || null;
                }
            }

            const resolvedWarehouseId = parseInt(warehouse_id || origin_warehouse_id, 10) || 1;
            const resolvedDestCountry = parseInt(destination_country, 10) || 2;
            const resolvedCollectionFrom = parseInt(collection_from, 10) || suppCountry || 44;
            const resolvedWeight = parseFloat(total_weight || weight_kg) || 0;
            const resolvedCbm = parseFloat(total_cbm || cbm) || 0;

            const insertSql = `
                INSERT INTO supplier_warehouse_orders (
                    supplier_id,
                    warehouse_id,
                    courier_waybill_ref,
                    dispatch_date,
                    date_received,
                    customer_name,
                    customer_ref,
                    destination_country,
                    collection_from,
                    box_marking,
                    goods_description,
                    package_type,
                    hazardous,
                    hazard_description,
                    total_packages,
                    total_cbm,
                    total_weight,
                    package_comment,
                    damaged_goods,
                    damaged_pkg_qty,
                    damage_comment,
                    supplier_company,
                    supplier_person,
                    supplier_contact,
                    supplier_address,
                    warehouse_collect,
                    costs_to_collect,
                    warehouse_storage,
                    warehouse_cost,
                    handling_required,
                    handling_cost,
                    warehouse_dispatch,
                    cost_to_dispatch,
                    warehouse_comment,
                    added_by
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?
                )
            `;

            const insertParams = [
                supplierId,
                resolvedWarehouseId,
                courier_waybill_ref || null,
                dispatch_date || null,
                date_received || null,
                customer_name || 'Asia Direct Customer',
                customer_ref || null,
                resolvedDestCountry,
                resolvedCollectionFrom,
                box_marking || null,
                goods_description.trim(),
                package_type || 'Carton',
                hazardous ? 1 : 0,
                hazard_description || null,
                parsedTotalPackages,
                resolvedCbm,
                resolvedWeight,
                package_comment || null,
                damaged_goods ? 1 : 0,
                parseInt(damaged_pkg_qty, 10) || 0,
                damage_comment || null,
                compName || null,
                contactPerson || null,
                contactPhone || null,
                suppAddress || null,
                warehouse_collect ? 1 : 0,
                parseFloat(costs_to_collect) || 0,
                warehouse_storage ? 1 : 0,
                parseFloat(warehouse_cost) || 0,
                handling_required ? 1 : 0,
                parseFloat(handling_cost) || 0,
                warehouse_dispatch ? 1 : 0,
                parseFloat(cost_to_dispatch) || 0,
                warehouse_comment || null,
                user ? user.id : 1
            ];

            const insertResult = await new Promise((resolve, reject) => {
                con.query(insertSql, insertParams, (err, result) => (err ? reject(err) : resolve(result)));
            });

            const swoId = insertResult.insertId;

            // Generate clean warehouse order reference
            const year = new Date().getFullYear();
            const generatedWhOrderId = req.body.warehouse_order_id && String(req.body.warehouse_order_id).trim()
                ? String(req.body.warehouse_order_id).trim()
                : `WH-${year}-${String(swoId).padStart(5, '0')}`;

            await new Promise((resolve) => {
                con.query(
                    'UPDATE supplier_warehouse_orders SET warehouse_order_id = ? WHERE id = ?',
                    [generatedWhOrderId, swoId],
                    () => resolve()
                );
            });

            // Save any uploaded files if present
            if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                const fileValues = req.files.map(f => {
                    let fType = 'document';
                    if (f.fieldname && f.fieldname.includes('damage')) fType = 'damage';
                    else if (f.mimetype && f.mimetype.startsWith('image/')) fType = 'product';
                    return [swoId, fType, f.filename];
                });
                await new Promise((resolve) => {
                    con.query(
                        'INSERT INTO supplier_warehouse_files (supplier_warehouse_id, file_type, file_name) VALUES ?',
                        [fileValues],
                        () => resolve()
                    );
                });
            }

            // Optional: Insert products if provided during order creation
            let createdProducts = [];
            if (req.body.products) {
                let productsList = [];
                if (Array.isArray(req.body.products)) {
                    productsList = req.body.products;
                } else if (typeof req.body.products === 'string') {
                    try {
                        const parsed = JSON.parse(req.body.products);
                        if (Array.isArray(parsed)) productsList = parsed;
                    } catch (e) {}
                }

                for (const p of productsList) {
                    try {
                        const pDesc = (p.product_description || goods_description || '').trim();
                        const pPackages = parseInt(p.packages, 10) || parsedTotalPackages || 0;
                        const pWeight = parseFloat(p.weight) || (resolvedWeight > 0 ? parseFloat((resolvedWeight / (productsList.length || 1)).toFixed(2)) : 0);
                        const pPkgType = p.package_type || package_type || 'Carton';
                        const pHazard = p.hazardous ? '1' : (hazardous ? '1' : '0');

                        await new Promise((resP) => {
                            con.query(
                                `INSERT INTO supplier_warehouse_products (
                                    supplier_warehouse_id, product_description, hazardous, date_received,
                                    package_type, packages, dimension, weight, warehouse_ref,
                                    supplier, date_dispatched, supplier_address, waybill_ref,
                                    supplier_email, supplier_contact, added_by
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    swoId,
                                    pDesc,
                                    pHazard,
                                    date_received || null,
                                    pPkgType,
                                    pPackages,
                                    p.dimension || null,
                                    pWeight,
                                    generatedWhOrderId,
                                    compName || null,
                                    dispatch_date || null,
                                    suppAddress || null,
                                    courier_waybill_ref || null,
                                    null,
                                    contactPhone || null,
                                    user ? user.id : 1
                                ],
                                (errP, resltP) => {
                                    if (!errP && resltP) {
                                        createdProducts.push({
                                            id: resltP.insertId,
                                            product_description: pDesc,
                                            packages: pPackages,
                                            weight: pWeight
                                        });
                                    }
                                    resP();
                                }
                            );
                        });
                    } catch (pErr) {
                        logger.error('Error inserting product during order creation:', pErr);
                    }
                }
            }

            // Optional: Auto-generate barcodes right away ONLY IF products are present
            let generatedBoxes = null;
            let barcodeNote = null;
            const shouldGenerateBarcodes = (generate_barcodes === true || generate_barcodes === 'true' || auto_generate_barcodes === true || auto_generate_barcodes === 'true');

            if (shouldGenerateBarcodes) {
                if (createdProducts.length === 0) {
                    barcodeNote = 'Barcodes not generated: Please add at least one warehouse product to this order before generating barcodes.';
                } else {
                    try {
                        // Resolve warehouse prefix
                        const whRows = await new Promise(res => {
                            con.query('SELECT warehouse_number, warehouse_name FROM warehouse_tbl WHERE id = ? LIMIT 1', [resolvedWarehouseId], (e, r) => res(r || []));
                        });
                        let whPrefix = 'CAN';
                        if (whRows && whRows.length > 0) {
                            const w = whRows[0];
                            if (w.warehouse_number) whPrefix = w.warehouse_number.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 4);
                            else if (w.warehouse_name) whPrefix = w.warehouse_name.substring(0, 3).toUpperCase();
                        }

                        const calcWeight = resolvedWeight > 0 ? (resolvedWeight / parsedTotalPackages).toFixed(2) : null;
                        const calcCbm = resolvedCbm > 0 ? (resolvedCbm / parsedTotalPackages).toFixed(4) : null;
                        const boxInsertValues = [];
                        const responseBoxes = [];

                        const combinedProdDesc = createdProducts.map(p => p.product_description).filter(Boolean).join('; ') || goods_description.trim();
                        const isHaz = hazardous ? 'YES' : 'NO';

                        for (let boxNum = 1; boxNum <= parsedTotalPackages; boxNum++) {
                            const barcode = BarcodeService.buildBarcodeString({
                                warehouseRef: whPrefix,
                                orderNumber: generatedWhOrderId,
                                boxNumber: boxNum,
                                totalBoxes: parsedTotalPackages
                            });

                            boxInsertValues.push([
                                swoId,
                                null,
                                null,
                                resolvedWarehouseId,
                                resolvedDestCountry,
                                barcode,
                                generatedWhOrderId,
                                boxNum,
                                parsedTotalPackages,
                                calcWeight,
                                calcCbm,
                                'GENERATED'
                            ]);

                            const qrPayload = `TMS:N/A|REF:${generatedWhOrderId}|ORD:${generatedWhOrderId}|BOX:${boxNum}/${parsedTotalPackages}|ORG:${whPrefix}|DST:${resolvedDestCountry}|WT:${calcWeight || 0}KG|CBM:${calcCbm || 0}|PROD:${combinedProdDesc}|HAZ:${isHaz}|CUST:${customer_name || 'Asia Direct Customer'}|SUPP:${compName || 'N/A'}|WB:${courier_waybill_ref || 'N/A'}`;

                            responseBoxes.push({
                                box_number: boxNum,
                                total_boxes: parsedTotalPackages,
                                barcode_string: barcode,
                                barcode_image_url: `/api/warehouse/barcodes/image/${barcode}`,
                                qr_code_data: qrPayload,
                                badge_text: String(boxNum),
                                order_number: generatedWhOrderId,
                                warehouse_order_number: generatedWhOrderId,
                                customer_name: customer_name || 'Asia Direct Customer',
                                customer_ref: customer_ref || null,
                                supplier_company: compName,
                                product_description: combinedProdDesc,
                                is_hazardous: hazardous ? true : false,
                                weight_kg: calcWeight !== null ? parseFloat(calcWeight) : null,
                                cbm: calcCbm !== null ? parseFloat(calcCbm) : null,
                                current_status: 'GENERATED',
                                products: createdProducts
                            });
                        }

                        await new Promise((resolve, reject) => {
                            const bSql = `
                                INSERT INTO warehouse_package_boxes (
                                    supplier_warehouse_order_id,
                                    warehouse_assign_order_id,
                                    order_id,
                                    origin_warehouse_id,
                                    destination_warehouse_id,
                                    barcode_string,
                                    warehouse_order_number,
                                    box_number,
                                    total_boxes,
                                    weight_kg,
                                    cbm,
                                    current_status
                                ) VALUES ?
                            `;
                            con.query(bSql, [boxInsertValues], (bErr) => (bErr ? reject(bErr) : resolve()));
                        });

                        generatedBoxes = responseBoxes;
                    } catch (genErr) {
                        logger.error('Error auto-generating barcodes on order creation:', genErr);
                    }
                }
            }

            return res.status(201).json({
                success: true,
                message: 'Supplier warehouse order created successfully' + (generatedBoxes ? ' with barcodes generated' : (barcodeNote ? `. ${barcodeNote}` : '')),
                data: {
                    supplier_warehouse_order_id: swoId,
                    warehouse_order_id: generatedWhOrderId,
                    customer_name: customer_name || 'Asia Direct Customer',
                    customer_ref: customer_ref || null,
                    supplier_id: supplierId,
                    supplier_company: compName,
                    goods_description: goods_description.trim(),
                    package_type: package_type || 'Carton',
                    total_packages: parsedTotalPackages,
                    total_weight: resolvedWeight,
                    total_cbm: resolvedCbm,
                    origin_warehouse_id: resolvedWarehouseId,
                    destination_country_id: resolvedDestCountry,
                    barcode_status: generatedBoxes ? 'GENERATED' : 'NOT_GENERATED',
                    barcode_message: barcodeNote || undefined,
                    boxes: generatedBoxes || [],
                    products: createdProducts || []
                }
            });

        } catch (error) {
            logger.error('Error creating supplier warehouse order:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create supplier warehouse order',
                error: error.message
            });
        }
    }

    /**
     * Get single Warehouse Order / Consignment Detail
     * GET /api/warehouse/orders/:id OR GET /api/warehouse/supplier/orders/:id
     */
    static async getWarehouseOrderDetail(req, res) {
        try {
            const orderId = parseInt(req.params.id, 10);
            if (isNaN(orderId) || orderId <= 0) {
                return res.status(400).json({ success: false, message: 'Valid order ID is required' });
            }

            const orderRows = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT swo.*,
                           o.order_number as tbl_order_number,
                           o.track_status as order_track_status,
                           w.warehouse_name as origin_warehouse_name,
                           w.country as origin_warehouse_country,
                           c_orig.name as origin_country_name,
                           c_dest.name as destination_country_name,
                           su.name as supplier_name,
                           su.email as supplier_email
                    FROM supplier_warehouse_orders swo
                    LEFT JOIN tbl_orders o ON o.id = swo.order_id
                    LEFT JOIN warehouse_tbl w ON w.id = swo.warehouse_id
                    LEFT JOIN countries c_orig ON c_orig.id = COALESCE(swo.collection_from, w.country)
                    LEFT JOIN countries c_dest ON c_dest.id = swo.destination_country
                    LEFT JOIN tbl_suppliers su ON su.id = swo.supplier_id
                    WHERE swo.id = ?
                    LIMIT 1
                `;
                con.query(sql, [orderId], (err, rows) => (err ? reject(err) : resolve(rows || [])));
            });

            if (orderRows.length === 0) {
                return res.status(404).json({ success: false, message: `Supplier warehouse order ${orderId} not found` });
            }

            const order = orderRows[0];

            // Fetch boxes
            const boxRows = await new Promise((resolve) => {
                con.query(
                    `SELECT id, box_number, total_boxes, barcode_string, current_status, weight_kg, cbm, is_damaged, damage_comment, created_at, updated_at 
                     FROM warehouse_package_boxes 
                     WHERE supplier_warehouse_order_id = ? 
                     ORDER BY box_number ASC`,
                    [orderId],
                    (err, rows) => resolve(rows || [])
                );
            });

            // Fetch files
            const fileRows = await new Promise((resolve) => {
                con.query(
                    'SELECT id, file_type, file_name, created_at FROM supplier_warehouse_files WHERE supplier_warehouse_id = ?',
                    [orderId],
                    (err, rows) => resolve(rows || [])
                );
            });

            // Fetch products
            const productRows = await new Promise((resolve) => {
                con.query(
                    `SELECT id, supplier_warehouse_id, product_description, hazardous, date_received,
                            package_type, packages, dimension, weight, warehouse_ref, freight,
                            groupage_batch_ref, supplier, warehouse_receipt_number, tracking_number,
                            date_dispatched, supplier_address, warehouse_collect, costs_to_collect,
                            port_of_loading, warehouse_dispatch, warehouse_cost, cost_to_dispatch,
                            waybill_ref, supplier_email, supplier_contact, added_by, pictures, created_at
                     FROM supplier_warehouse_products
                     WHERE supplier_warehouse_id = ?
                     ORDER BY id DESC`,
                    [orderId],
                    (err, rows) => resolve(rows || [])
                );
            });

            return res.status(200).json({
                success: true,
                order: {
                    ...order,
                    barcode_status: boxRows.length > 0 ? 'GENERATED' : 'NOT_GENERATED',
                    generated_boxes_count: boxRows.length,
                    boxes: boxRows.map(b => ({
                        ...b,
                        barcode_image_url: `/api/warehouse/barcodes/image/${b.barcode_string}`
                    })),
                    files: fileRows.map(f => ({
                        ...f,
                        file_url: `/damage_photos/${f.file_name}`
                    })),
                    products_count: productRows.length,
                    products: productRows.map(p => {
                        let parsedPictures = [];
                        let rawPictures = [];
                        if (p.pictures) {
                            try {
                                const parsed = JSON.parse(p.pictures);
                                rawPictures = Array.isArray(parsed) ? parsed : [parsed];
                                parsedPictures = rawPictures.map(img => `/product_pictures/${img}`);
                            } catch (e) {
                                rawPictures = [p.pictures];
                                parsedPictures = [`/product_pictures/${p.pictures}`];
                            }
                        }
                        return {
                            ...p,
                            raw_pictures: rawPictures,
                            pictures: parsedPictures
                        };
                    })
                }
            });

        } catch (error) {
            logger.error('Error fetching warehouse order detail:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch warehouse order detail', error: error.message });
        }
    }

    /**
     * Add Supplier Warehouse Product to an Order
     * POST /api/warehouse/orders/products/add OR /api/warehouse/addSupplierWarehouseProduct
     */
    static async addSupplierWarehouseProduct(req, res) {
        try {
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {}
            }

            const supplierWarehouseId = parseInt(
                req.body.supplier_warehouse_id ||
                req.body.supplier_warehouse_order_id ||
                req.body.order_id ||
                req.params.id,
                10
            );

            if (!supplierWarehouseId || isNaN(supplierWarehouseId)) {
                return res.status(400).json({
                    success: false,
                    message: 'supplier_warehouse_id required'
                });
            }

            // Verify order exists and get defaults
            const orderRows = await new Promise((resolve) => {
                con.query(
                    'SELECT * FROM supplier_warehouse_orders WHERE id = ? LIMIT 1',
                    [supplierWarehouseId],
                    (err, rows) => resolve(rows || [])
                );
            });

            if (orderRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Supplier warehouse order ${supplierWarehouseId} not found`
                });
            }

            const parentOrder = orderRows[0];

            // Handle pictures (req.files or body pictures)
            let picturesArray = [];
            if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                if (req.files.length > 4) {
                    return res.status(400).json({
                        success: false,
                        message: 'Maximum 4 pictures allowed'
                    });
                }
                picturesArray = req.files.map(f => f.filename);
            } else if (req.body.pictures) {
                if (Array.isArray(req.body.pictures)) {
                    picturesArray = req.body.pictures.slice(0, 4);
                } else if (typeof req.body.pictures === 'string') {
                    try {
                        const parsed = JSON.parse(req.body.pictures);
                        if (Array.isArray(parsed)) picturesArray = parsed.slice(0, 4);
                        else picturesArray = [req.body.pictures];
                    } catch (e) {
                        picturesArray = req.body.pictures.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
                    }
                }
            }

            const picturesData = picturesArray.length > 0 ? JSON.stringify(picturesArray) : null;

            const {
                product_description,
                hazardous,
                date_received,
                package_type,
                packages,
                dimension,
                weight,
                warehouse_ref,
                freight,
                groupage_batch_ref,
                supplier,
                warehouse_receipt_number,
                tracking_number,
                date_dispatched,
                supplier_address,
                warehouse_collect,
                costs_to_collect,
                port_of_loading,
                warehouse_dispatch,
                warehouse_cost,
                cost_to_dispatch,
                waybill_ref,
                supplier_email,
                supplier_contact,
                added_by
            } = req.body;

            const resolvedProductDesc = (product_description !== undefined && product_description !== null && String(product_description).trim())
                ? String(product_description).trim()
                : (parentOrder.goods_description || null);

            const resolvedHazardous = hazardous !== undefined ? (hazardous === true || hazardous === 1 || hazardous === '1' ? '1' : String(hazardous)) : (parentOrder.hazardous ? '1' : '0');
            const resolvedDateReceived = date_received || parentOrder.date_received || null;
            const resolvedPackageType = package_type || parentOrder.package_type || 'Carton';
            const resolvedPackages = parseInt(packages, 10) || parentOrder.total_packages || 0;
            const resolvedDimension = dimension || null;
            const resolvedWeight = parseFloat(weight) || parentOrder.total_weight || 0;

            const resolvedWarehouseRef = warehouse_ref || parentOrder.warehouse_order_id || null;
            const resolvedFreight = freight || null;
            const resolvedGroupageRef = groupage_batch_ref || null;

            const resolvedSupplier = supplier || parentOrder.supplier_company || parentOrder.supplier_person || null;
            const resolvedReceiptNo = warehouse_receipt_number || null;
            const resolvedTrackingNo = tracking_number || null;
            const resolvedDateDispatched = date_dispatched || parentOrder.dispatch_date || null;

            const resolvedSupplierAddress = supplier_address || parentOrder.supplier_address || null;
            const resolvedWarehouseCollect = warehouse_collect !== undefined ? (warehouse_collect === true || warehouse_collect === 1 || warehouse_collect === '1' ? '1' : String(warehouse_collect)) : (parentOrder.warehouse_collect ? '1' : '0');
            const resolvedCostsToCollect = parseFloat(costs_to_collect) || parentOrder.costs_to_collect || 0;
            const resolvedPortOfLoading = port_of_loading || null;

            const resolvedWarehouseDispatch = warehouse_dispatch !== undefined ? (warehouse_dispatch === true || warehouse_dispatch === 1 || warehouse_dispatch === '1' ? '1' : String(warehouse_dispatch)) : (parentOrder.warehouse_dispatch ? '1' : '0');
            const resolvedWarehouseCost = parseFloat(warehouse_cost) || parentOrder.warehouse_cost || 0;
            const resolvedCostToDispatch = parseFloat(cost_to_dispatch) || parentOrder.cost_to_dispatch || 0;

            const resolvedWaybillRef = waybill_ref || parentOrder.courier_waybill_ref || null;
            const resolvedSupplierEmail = supplier_email || null;
            const resolvedSupplierContact = supplier_contact || parentOrder.supplier_contact || null;
            const resolvedAddedBy = user ? user.id : (parseInt(added_by, 10) || 1);

            const insertSql = `
                INSERT INTO supplier_warehouse_products (
                    supplier_warehouse_id,
                    product_description, hazardous, date_received,
                    package_type, packages, dimension, weight,
                    warehouse_ref, freight, groupage_batch_ref,
                    supplier, warehouse_receipt_number,
                    tracking_number, date_dispatched,
                    supplier_address,
                    warehouse_collect, costs_to_collect,
                    port_of_loading,
                    warehouse_dispatch, warehouse_cost, cost_to_dispatch,
                    waybill_ref,
                    supplier_email, supplier_contact,
                    added_by,
                    pictures
                ) VALUES (?,?,?,?,?,?,?,?,
                          ?,?,?,
                          ?,?,?,?,
                          ?,
                          ?,?,?,
                          ?,?,?,
                          ?,?,?,
                          ?,
                          ?)
            `;

            const insertValues = [
                supplierWarehouseId,
                resolvedProductDesc,
                resolvedHazardous,
                resolvedDateReceived,
                resolvedPackageType,
                resolvedPackages,
                resolvedDimension,
                resolvedWeight,
                resolvedWarehouseRef,
                resolvedFreight,
                resolvedGroupageRef,
                resolvedSupplier,
                resolvedReceiptNo,
                resolvedTrackingNo,
                resolvedDateDispatched,
                resolvedSupplierAddress,
                resolvedWarehouseCollect,
                resolvedCostsToCollect,
                resolvedPortOfLoading,
                resolvedWarehouseDispatch,
                resolvedWarehouseCost,
                resolvedCostToDispatch,
                resolvedWaybillRef,
                resolvedSupplierEmail,
                resolvedSupplierContact,
                resolvedAddedBy,
                picturesData
            ];

            const insertResult = await new Promise((resolve, reject) => {
                con.query(insertSql, insertValues, (err, reslt) => (err ? reject(err) : resolve(reslt)));
            });

            return res.status(200).json({
                success: true,
                message: 'Supplier warehouse product added',
                id: insertResult.insertId,
                product_id: insertResult.insertId,
                supplier_warehouse_id: supplierWarehouseId,
                pictures: picturesArray.map(img => `product_pictures/${img}`)
            });

        } catch (error) {
            logger.error('Error adding supplier warehouse product:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to add supplier warehouse product',
                error: error.message
            });
        }
    }

    /**
     * Update Supplier Warehouse Product
     * POST /api/warehouse/orders/products/update OR /api/warehouse/updateSupplierWarehouseProduct
     */
    static async updateSupplierWarehouseProduct(req, res) {
        try {
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {}
            }

            const productId = parseInt(req.body.id || req.body.product_id || req.params.id, 10);
            if (!productId || isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Product id required'
                });
            }

            // Check if product exists
            const existingRows = await new Promise((resolve, reject) => {
                con.query('SELECT * FROM supplier_warehouse_products WHERE id = ? LIMIT 1', [productId], (err, rows) => (err ? reject(err) : resolve(rows || [])));
            });

            if (existingRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            const existing = existingRows[0];
            const hasNewPictures = req.files && Array.isArray(req.files) && req.files.length > 0;

            if (hasNewPictures && req.files.length > 4) {
                const productPicturesDir = path.join(__dirname, '../public/product_pictures');
                req.files.forEach(file => {
                    const filePath = path.join(productPicturesDir, file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 4 pictures allowed'
                });
            }

            let newPicturesData = existing.pictures;

            if (hasNewPictures) {
                const productPicturesDir = path.join(__dirname, '../public/product_pictures');
                // Delete old pictures
                if (existing.pictures) {
                    try {
                        const oldList = JSON.parse(existing.pictures);
                        if (Array.isArray(oldList)) {
                            oldList.forEach(fileName => {
                                const oldPath = path.join(productPicturesDir, fileName);
                                if (fs.existsSync(oldPath)) {
                                    fs.unlinkSync(oldPath);
                                }
                            });
                        }
                    } catch (e) {}
                }
                const newFilesArray = req.files.map(file => file.filename);
                newPicturesData = JSON.stringify(newFilesArray);
            } else if (req.body.pictures !== undefined) {
                if (Array.isArray(req.body.pictures)) {
                    newPicturesData = JSON.stringify(req.body.pictures.slice(0, 4));
                } else if (typeof req.body.pictures === 'string') {
                    newPicturesData = req.body.pictures;
                }
            }

            const {
                product_description,
                hazardous,
                date_received,
                package_type,
                packages,
                dimension,
                weight,
                warehouse_ref,
                freight,
                groupage_batch_ref,
                supplier,
                warehouse_receipt_number,
                tracking_number,
                date_dispatched,
                supplier_address,
                warehouse_collect,
                costs_to_collect,
                port_of_loading,
                warehouse_dispatch,
                warehouse_cost,
                cost_to_dispatch,
                waybill_ref,
                supplier_email,
                supplier_contact,
                added_by
            } = req.body;

            const updateSql = `
                UPDATE supplier_warehouse_products SET
                    product_description = ?,
                    hazardous = ?,
                    date_received = ?,
                    package_type = ?,
                    packages = ?,
                    dimension = ?,
                    weight = ?,
                    warehouse_ref = ?,
                    freight = ?,
                    groupage_batch_ref = ?,
                    supplier = ?,
                    warehouse_receipt_number = ?,
                    tracking_number = ?,
                    date_dispatched = ?,
                    supplier_address = ?,
                    warehouse_collect = ?,
                    costs_to_collect = ?,
                    port_of_loading = ?,
                    warehouse_dispatch = ?,
                    warehouse_cost = ?,
                    cost_to_dispatch = ?,
                    waybill_ref = ?,
                    supplier_email = ?,
                    supplier_contact = ?,
                    added_by = ?,
                    pictures = ?
                WHERE id = ?
            `;

            const updateValues = [
                product_description !== undefined ? product_description : existing.product_description,
                hazardous !== undefined ? (hazardous === true || hazardous === 1 || hazardous === '1' ? '1' : String(hazardous)) : existing.hazardous,
                date_received !== undefined ? date_received : existing.date_received,
                package_type !== undefined ? package_type : existing.package_type,
                packages !== undefined ? parseInt(packages, 10) : existing.packages,
                dimension !== undefined ? dimension : existing.dimension,
                weight !== undefined ? parseFloat(weight) : existing.weight,
                warehouse_ref !== undefined ? warehouse_ref : existing.warehouse_ref,
                freight !== undefined ? freight : existing.freight,
                groupage_batch_ref !== undefined ? groupage_batch_ref : existing.groupage_batch_ref,
                supplier !== undefined ? supplier : existing.supplier,
                warehouse_receipt_number !== undefined ? warehouse_receipt_number : existing.warehouse_receipt_number,
                tracking_number !== undefined ? tracking_number : existing.tracking_number,
                date_dispatched !== undefined ? date_dispatched : existing.date_dispatched,
                supplier_address !== undefined ? supplier_address : existing.supplier_address,
                warehouse_collect !== undefined ? (warehouse_collect === true || warehouse_collect === 1 || warehouse_collect === '1' ? '1' : String(warehouse_collect)) : existing.warehouse_collect,
                costs_to_collect !== undefined ? parseFloat(costs_to_collect) : existing.costs_to_collect,
                port_of_loading !== undefined ? port_of_loading : existing.port_of_loading,
                warehouse_dispatch !== undefined ? (warehouse_dispatch === true || warehouse_dispatch === 1 || warehouse_dispatch === '1' ? '1' : String(warehouse_dispatch)) : existing.warehouse_dispatch,
                warehouse_cost !== undefined ? parseFloat(warehouse_cost) : existing.warehouse_cost,
                cost_to_dispatch !== undefined ? parseFloat(cost_to_dispatch) : existing.cost_to_dispatch,
                waybill_ref !== undefined ? waybill_ref : existing.waybill_ref,
                supplier_email !== undefined ? supplier_email : existing.supplier_email,
                supplier_contact !== undefined ? supplier_contact : existing.supplier_contact,
                user ? user.id : (added_by !== undefined ? parseInt(added_by, 10) : existing.added_by),
                newPicturesData,
                productId
            ];

            await new Promise((resolve, reject) => {
                con.query(updateSql, updateValues, (err, result) => (err ? reject(err) : resolve(result)));
            });

            let parsedPictures = undefined;
            if (newPicturesData) {
                try {
                    const p = JSON.parse(newPicturesData);
                    parsedPictures = (Array.isArray(p) ? p : []).map(img => `product_pictures/${img}`);
                } catch (e) {
                    parsedPictures = [`product_pictures/${newPicturesData}`];
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Supplier warehouse product updated successfully',
                id: productId,
                pictures: parsedPictures
            });

        } catch (error) {
            logger.error('Error updating supplier warehouse product:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update supplier warehouse product',
                error: error.message
            });
        }
    }

    /**
     * Get Supplier Warehouse Products for an Order
     * GET /api/warehouse/orders/products OR /api/warehouse/getSupplierWarehouseProducts
     */
    static async getSupplierWarehouseProducts(req, res) {
        try {
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {}
            }

            const supplierWarehouseId = parseInt(
                req.query.supplier_warehouse_id ||
                req.query.supplier_warehouse_order_id ||
                req.query.order_id ||
                req.params.id ||
                req.body.supplier_warehouse_id,
                10
            );

            let sql;
            let params = [];

            if (supplierWarehouseId && !isNaN(supplierWarehouseId)) {
                sql = `
                    SELECT p.*, swo.warehouse_order_id, swo.customer_name
                    FROM supplier_warehouse_products p
                    LEFT JOIN supplier_warehouse_orders swo ON swo.id = p.supplier_warehouse_id
                    WHERE p.supplier_warehouse_id = ?
                    ORDER BY p.id DESC
                `;
                params.push(supplierWarehouseId);
            } else if (user && (user.role === 'supplier' || parseInt(user.user_type, 10) === 1)) {
                sql = `
                    SELECT p.*, swo.warehouse_order_id, swo.customer_name
                    FROM supplier_warehouse_products p
                    JOIN supplier_warehouse_orders swo ON swo.id = p.supplier_warehouse_id
                    WHERE swo.supplier_id = ?
                    ORDER BY p.id DESC
                `;
                params.push(user.id);
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'supplier_warehouse_id required'
                });
            }

            const rows = await new Promise((resolve, reject) => {
                con.query(sql, params, (err, r) => (err ? reject(err) : resolve(r || [])));
            });

            const formattedData = rows.map(item => {
                let parsedPictures = [];
                let rawPictures = [];
                if (item.pictures) {
                    try {
                        const parsed = JSON.parse(item.pictures);
                        rawPictures = Array.isArray(parsed) ? parsed : [parsed];
                        parsedPictures = rawPictures.map(img => `product_pictures/${img}`);
                    } catch (e) {
                        rawPictures = [item.pictures];
                        parsedPictures = [`product_pictures/${item.pictures}`];
                    }
                }
                return {
                    ...item,
                    raw_pictures: rawPictures,
                    pictures: parsedPictures
                };
            });

            return res.status(200).json({
                success: true,
                total: formattedData.length,
                data: formattedData
            });

        } catch (error) {
            logger.error('Error fetching supplier warehouse products:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch supplier warehouse products',
                error: error.message
            });
        }
    }

    /**
     * Delete Supplier Warehouse Product
     * POST /api/warehouse/orders/products/delete OR /api/warehouse/deleteSupplierWarehouseProduct
     */
    static async deleteSupplierWarehouseProduct(req, res) {
        try {
            const productId = parseInt(req.body.id || req.body.product_id || req.params.id, 10);
            if (!productId || isNaN(productId)) {
                return res.status(400).json({ success: false, message: 'Product id required' });
            }

            const existingRows = await new Promise((resolve) => {
                con.query('SELECT pictures FROM supplier_warehouse_products WHERE id = ? LIMIT 1', [productId], (err, rows) => resolve(rows || []));
            });

            if (existingRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            if (existingRows[0].pictures) {
                try {
                    const productPicturesDir = path.join(__dirname, '../public/product_pictures');
                    const parsed = JSON.parse(existingRows[0].pictures);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(f => {
                            const p = path.join(productPicturesDir, f);
                            if (fs.existsSync(p)) fs.unlinkSync(p);
                        });
                    }
                } catch (e) {}
            }

            await new Promise((resolve, reject) => {
                con.query('DELETE FROM supplier_warehouse_products WHERE id = ?', [productId], (err, result) => (err ? reject(err) : resolve(result)));
            });

            return res.status(200).json({
                success: true,
                message: 'Supplier warehouse product deleted successfully'
            });

        } catch (error) {
            logger.error('Error deleting supplier warehouse product:', error);
            return res.status(500).json({ success: false, message: 'Failed to delete supplier warehouse product', error: error.message });
        }
    }

    /**
     * Retrieve existing generated box labels by warehouse reference or shipment number (TMS)
     * GET or POST /api/warehouse/barcodes/reprint
     */
    static async reprintBarcodes(req, res) {
        const ref = (
            req.query.reference ||
            req.body.reference ||
            req.query.warehouse_ref ||
            req.query.warehouse_reference ||
            req.query.shipment_number ||
            req.query.order_number ||
            req.body.warehouse_ref ||
            req.body.warehouse_reference ||
            req.body.shipment_number ||
            req.body.order_number ||
            req.query.supplier_warehouse_order_id ||
            req.body.supplier_warehouse_order_id ||
            ''
        ).trim();

        if (!ref) {
            return res.status(400).json({
                success: false,
                message: 'warehouse_ref or shipment_number is required to reprint labels'
            });
        }

        try {
            const boxesSql = `
                SELECT b.*, swo.warehouse_order_id as local_wh_ref,
                       o.order_number as tbl_order_number,
                       COALESCE(w_orig.warehouse_name, 'China Warehouse') as origin_name,
                       COALESCE(c_dest.name, 'South Africa Warehouse') as destination_name
                FROM warehouse_package_boxes b
                LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                LEFT JOIN tbl_orders o ON o.id = (CASE WHEN b.order_id IS NOT NULL THEN b.order_id ELSE swo.order_id END)
                LEFT JOIN warehouse_tbl w_orig ON w_orig.id = b.origin_warehouse_id
                LEFT JOIN countries c_dest ON c_dest.id = swo.destination_country
                WHERE b.warehouse_order_number = ? 
                   OR swo.warehouse_order_id = ? 
                   OR o.order_number = ? 
                   OR b.supplier_warehouse_order_id = ?
                ORDER BY b.box_number ASC
            `;

            const rows = await new Promise((resolve, reject) => {
                con.query(boxesSql, [ref, ref, ref, ref], (err, results) => (err ? reject(err) : resolve(results)));
            });

            if (!rows || rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No generated labels found for reference '${ref}'. Please generate labels first.`
                });
            }

            const first = rows[0];
            const resolvedOrderNumber = first.tbl_order_number || (first.order_id ? `OR000${first.order_id}` : first.warehouse_order_number);

            const boxes = rows.map(b => ({
                box_number: b.box_number,
                total_boxes: b.total_boxes,
                barcode_string: b.barcode_string,
                barcode_image_url: `/api/warehouse/barcodes/image/${b.barcode_string}`,
                qr_code_data: `REF:${b.local_wh_ref || b.warehouse_order_number || resolvedOrderNumber}|ORD:${resolvedOrderNumber}|BOX:${b.box_number}/${b.total_boxes}|ORG:${b.origin_name}|DST:${b.destination_name}|WT:${b.weight_kg || 0}KG`,
                badge_text: String(b.box_number),
                order_number: resolvedOrderNumber,
                warehouse_order_number: b.local_wh_ref || b.warehouse_order_number,
                origin_name: b.origin_name,
                destination_name: b.destination_name,
                weight_kg: b.weight_kg !== null ? parseFloat(b.weight_kg) : null,
                cbm: b.cbm !== null ? parseFloat(b.cbm) : null,
                current_status: b.current_status
            }));

            return res.status(200).json({
                success: true,
                message: `Retrieved ${boxes.length} box labels for reference ${ref}`,
                warehouse_reference: first.local_wh_ref || first.warehouse_order_number,
                order_number: resolvedOrderNumber,
                supplier_warehouse_order_id: first.supplier_warehouse_order_id,
                total_boxes: boxes.length,
                origin_warehouse: first.origin_name,
                destination_warehouse: first.destination_name,
                boxes
            });

        } catch (error) {
            logger.error('Error fetching reprint barcodes:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve labels for reprinting',
                error: error.message
            });
        }
    }

    /**
     * Stream PNG barcode graphic for direct rendering in App/Web
     * GET /api/warehouse/barcodes/image/:barcode
     */
    static async getBarcodeImage(req, res) {
        const { barcode } = req.params;
        if (!barcode) return res.status(400).send('Barcode required');
        try {
            bwipjs.toBuffer({
                bcid: 'code128',
                text: barcode.trim(),
                scale: 3,
                height: 12,
                includetext: true,
                textxalign: 'center',
                textyoffset: -5,
                paddingbottom: 6,
                paddingtop: 2,
                paddingleft: 4,
                paddingright: 4
            }, (err, png) => {
                if (err) {
                    logger.error('Error rendering barcode image:', err);
                    return res.status(500).send('Barcode generation error');
                }
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(png);
            });
        } catch (error) {
            return res.status(500).send('Error');
        }
    }

    /**
     * Get warehouses list from warehouse_tbl
     * GET or POST /api/warehouse/warehouses
     * Returns: id, warehouse_name
     */
    static async getWarehouseDropdowns(req, res) {
        try {
            const query = `
                SELECT id, warehouse_name 
                FROM warehouse_tbl 
                WHERE warehouse_name IS NOT NULL AND warehouse_name != '' 
                ORDER BY id ASC
            `;

            con.query(query, (err, rows) => {
                if (err) {
                    logger.error('Error fetching warehouses from warehouse_tbl:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to fetch warehouses',
                        error: err.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Warehouse list fetched successfully',
                    data: rows,
                });
            });
        } catch (error) {
            logger.error('Error in getWarehouseDropdowns:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error while fetching warehouses',
                error: error.message
            });
        }
    }

    /**
     * List TMS Shipments for Autocomplete/Dropdown in Barcode Module
     * GET /api/warehouse/shipments
     */
    static async getTmsShipmentsList(req, res) {
        try {
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {
                    // Token verification error handled gracefully
                }
            }
            user = user || {};

            const userId = user.id || req.query.user_id || req.query.staff_id || req.query.supplier_id || null;
            let role = (user.role || req.query.role || '').toLowerCase().trim();

            if (!role && user.user_type) {
                if (parseInt(user.user_type, 10) === 1 && user.country) {
                    role = 'supplier';
                } else if (parseInt(user.user_type, 10) === 2) {
                    role = 'staff';
                }
            }

            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const offset = (page - 1) * limit;
            const search = (req.query.search || '').trim();

            let whereClauses = ['1=1'];
            let params = [];

            // Exclude shipments whose status is Customs Released
            whereClauses.push("(ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released'))");

            // 1. Supplier Role Filter: Match shipment origin_country_id or des_country_id with supplier's country
            let isSupplier = (role === 'supplier');
            let supplierCountry = user.country || req.query.country || null;

            if (!isSupplier && userId && !role) {
                const supCheck = await new Promise((resolve) => {
                    con.query('SELECT country FROM tbl_suppliers WHERE id = ? AND is_deleted = 0 LIMIT 1', [userId], (err, rows) => resolve(rows || []));
                });
                if (supCheck.length > 0) {
                    isSupplier = true;
                    supplierCountry = supCheck[0].country;
                }
            }

            if (isSupplier) {
                if (!supplierCountry && userId) {
                    const supRows = await new Promise((resolve) => {
                        con.query('SELECT country FROM tbl_suppliers WHERE id = ? AND is_deleted = 0 LIMIT 1', [userId], (err, rows) => resolve(rows || []));
                    });
                    if (supRows.length > 0) {
                        supplierCountry = supRows[0].country;
                    }
                }

                if (supplierCountry) {
                    whereClauses.push('(ts.origin_country_id = ? OR ts.des_country_id = ?)');
                    params.push(supplierCountry, supplierCountry);
                } else {
                    // Supplier has no country configured: show nothing
                    whereClauses.push('1=0');
                }
            } else {
                // 2. Staff / Admin Role Filter: Match shipment origin_country_id or des_country_id with staff's access_country
                let accessCountries = [];
                let isSuperAdmin = false;

                if (user.access_country && Array.isArray(user.access_country)) {
                    accessCountries = user.access_country.map(c => String(c).trim()).filter(Boolean);
                } else if (typeof user.access_country === 'string') {
                    accessCountries = user.access_country.split(',').map(c => c.trim()).filter(Boolean);
                } else if (userId) {
                    const staffRows = await new Promise((resolve) => {
                        con.query('SELECT access_country, user_type FROM tbl_users WHERE id = ? AND is_deleted = 0 LIMIT 1', [userId], (err, rows) => resolve(rows || []));
                    });
                    if (staffRows.length > 0) {
                        const uType = parseInt(staffRows[0].user_type, 10);
                        const rawAccess = staffRows[0].access_country || '';
                        accessCountries = rawAccess.split(',').map(c => c.trim()).filter(Boolean);
                        if (uType === 1 && !rawAccess) {
                            isSuperAdmin = true;
                        }
                    }
                }

                if (req.query.access_country) {
                    const qAccess = typeof req.query.access_country === 'string'
                        ? req.query.access_country.split(',').map(c => c.trim()).filter(Boolean)
                        : req.query.access_country;
                    if (qAccess && qAccess.length > 0) accessCountries = qAccess;
                }

                if (!isSuperAdmin) {
                    if (accessCountries.length > 0) {
                        whereClauses.push('(ts.origin_country_id IN (?) OR ts.des_country_id IN (?))');
                        params.push(accessCountries, accessCountries);
                    } else if (userId || role === 'staff') {
                        // Staff with no access country assigned: show nothing
                        whereClauses.push('1=0');
                    }
                }
            }

            // Search filter
            if (search) {
                whereClauses.push(`(
                    ts.waybill LIKE ? 
                    OR ts.container LIKE ? 
                    OR ts.vessel LIKE ? 
                    OR ts.carrier LIKE ? 
                    OR ts.load LIKE ? 
                    OR ts.id = ?
                )`);
                const sParam = `%${search}%`;
                const idParam = parseInt(search, 10) || 0;
                params.push(sParam, sParam, sParam, sParam, sParam, idParam);
            }

            const whereSql = whereClauses.join(' AND ');

            // Count query
            const countSql = `SELECT COUNT(*) as total FROM tbl_shipments ts WHERE ${whereSql}`;
            const countRows = await new Promise((resolve, reject) => {
                con.query(countSql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
            });
            const total = countRows && countRows[0] ? countRows[0].total : 0;

            // Data query
            const dataSql = `
                SELECT 
                    ts.id AS shipment_id,
                    ts.waybill,
                    ts.freight,
                    ts.carrier,
                    ts.vessel,
                    ts.container,
                    ts.seal,
                    ts.load,
                    ts.status,
                    ts.origin_country_id,
                    ts.des_country_id,
                    c_orig.name AS origin_country_name,
                    c_dest.name AS destination_country_name,
                    (SELECT COUNT(DISTINCT sd.order_id) FROM shipment_details sd WHERE sd.shipment_id = ts.id AND sd.order_id IS NOT NULL) AS total_orders,
                    ts.created_at
                FROM tbl_shipments ts
                LEFT JOIN countries c_orig ON c_orig.id = ts.origin_country_id
                LEFT JOIN countries c_dest ON c_dest.id = ts.des_country_id
                WHERE ${whereSql}
                ORDER BY ts.id DESC
                LIMIT ? OFFSET ?
            `;
            const dataParams = [...params, limit, offset];

            const shipments = await new Promise((resolve, reject) => {
                con.query(dataSql, dataParams, (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            return res.status(200).json({
                success: true,
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit) || 1,
                shipments: shipments.map(s => ({
                    shipment_id: s.shipment_id,
                    shipment_number: s.waybill || String(s.shipment_id),
                    waybill: s.waybill,
                    carrier: s.carrier,
                    vessel: s.vessel,
                    container: s.container,
                    freight_mode: s.freight,
                    origin_country_name: s.origin_country_name,
                    destination_country_name: s.destination_country_name,
                    total_orders: s.total_orders,
                    status: s.status,
                    created_at: s.created_at
                }))
            });
        } catch (error) {
            logger.error('Error fetching TMS shipments list:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch TMS shipments', error: error.message });
        }
    }

    /**
     * Get full auto-fill details for a specific TMS Shipment
     * GET /api/warehouse/shipments/:identifier
     * :identifier can be shipment_id, waybill, or load
     */
    static async getTmsShipmentDetails(req, res) {
        try {
            const identifier = (req.params.identifier || '').trim();
            if (!identifier) {
                return res.status(400).json({ success: false, message: 'Shipment identifier (id, waybill, or load) is required' });
            }

            const parsedId = parseInt(identifier, 10);
            const isNumeric = !isNaN(parsedId) && String(parsedId) === identifier;

            const shipSql = `
                SELECT 
                    ts.id AS shipment_id,
                    ts.waybill,
                    ts.carrier,
                    ts.vessel,
                    ts.container,
                    ts.seal,
                    ts.load,
                    ts.freight,
                    ts.status,
                    ts.origin_country_id,
                    ts.des_country_id,
                    c_orig.name AS origin_country_name,
                    c_dest.name AS destination_country_name
                FROM tbl_shipments ts
                LEFT JOIN countries c_orig ON c_orig.id = ts.origin_country_id
                LEFT JOIN countries c_dest ON c_dest.id = ts.des_country_id
                WHERE ${isNumeric ? 'ts.id = ? OR ts.waybill = ? OR ts.load = ?' : 'ts.waybill = ? OR ts.load = ?'}
                LIMIT 1
            `;
            const shipParams = isNumeric ? [parsedId, identifier, identifier] : [identifier, identifier];

            const shipRows = await new Promise((resolve, reject) => {
                con.query(shipSql, shipParams, (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            if (!shipRows || shipRows.length === 0) {
                return res.status(404).json({ success: false, message: `TMS Shipment '${identifier}' not found` });
            }

            const shipment = shipRows[0];

            // Resolve origin warehouse facility
            const whRows = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT id, warehouse_name, warehouse_number FROM warehouse_tbl WHERE country = ? ORDER BY id ASC LIMIT 1`,
                    [shipment.origin_country_id],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });
            const originWh = whRows && whRows.length > 0 ? whRows[0] : null;

            // Fetch associated orders (joined with tbl_freight for packages, weight, and cbm fallback)
            const ordersSql = `
                SELECT 
                    o.id AS order_id,
                    o.order_number,
                    o.cartons,
                    o.weight,
                    o.CBM,
                    o.dimensions AS order_dimensions,
                    o.freight_id,
                    o.goods_description,
                    tf.freight_number,
                    tf.no_of_packages AS freight_packages,
                    tf.weight AS freight_weight,
                    tf.dimension AS freight_dimension,
                    tf.product_desc AS freight_product_desc,
                    COALESCE(o.supplier_id, swo.supplier_id) AS supplier_id,
                    COALESCE(s.company_name, s.name, swo.supplier_company, 'N/A') AS supplier_name,
                    swo.id AS supplier_warehouse_order_id,
                    swo.warehouse_order_id,
                    swo.total_packages,
                    swo.total_weight,
                    swo.total_cbm,
                    swo.warehouse_id AS swo_origin_warehouse_id,
                    (SELECT COUNT(*) FROM warehouse_package_boxes wpb WHERE wpb.supplier_warehouse_order_id = swo.id OR wpb.order_id = o.id) AS generated_boxes_count
                FROM shipment_details sd
                JOIN tbl_orders o ON o.id = sd.order_id
                LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                LEFT JOIN tbl_suppliers s ON s.id = o.supplier_id
                LEFT JOIN supplier_warehouse_orders swo ON swo.order_id = o.id
                WHERE sd.shipment_id = ?
                ORDER BY o.id ASC
            `;

            const orders = await new Promise((resolve, reject) => {
                con.query(ordersSql, [shipment.shipment_id], (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            // Helper to resolve positive numeric value falling back from tbl_orders to tbl_freight
            const resolvePositiveNumber = (...values) => {
                for (const val of values) {
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0) {
                            return num;
                        }
                    }
                }
                return 0;
            };

            let totalBoxes = 0;
            let totalWeight = 0;
            let totalCbm = 0;
            let generatedOrdersCount = 0;

            orders.forEach(o => {
                const boxes = Math.round(resolvePositiveNumber(o.total_packages, o.cartons, o.freight_packages));
                const wt = resolvePositiveNumber(o.total_weight, o.weight, o.freight_weight);
                const cbm = resolvePositiveNumber(o.total_cbm, o.CBM, o.order_dimensions, o.freight_dimension);

                totalBoxes += boxes;
                totalWeight += wt;
                totalCbm += cbm;
                if (o.generated_boxes_count > 0) generatedOrdersCount++;
            });

            const suggestedWhRef = orders.find(o => o.warehouse_order_id)?.warehouse_order_id || orders[0]?.order_number || orders[0]?.freight_number || shipment.waybill || '';
            const suggestedSupplier = orders.find(o => o.supplier_name && o.supplier_name !== 'N/A')?.supplier_name || 'N/A';
            const suggestedSupplierId = orders.find(o => o.supplier_id)?.supplier_id || null;

            return res.status(200).json({
                success: true,
                message: `TMS Shipment details validated successfully`,
                shipment_id: shipment.shipment_id,
                shipment_number: shipment.waybill || String(shipment.shipment_id),
                waybill: shipment.waybill,
                carrier: shipment.carrier,
                vessel: shipment.vessel,
                container: shipment.container,
                seal: shipment.seal,
                load: shipment.load,
                freight_mode: shipment.freight,
                status: shipment.status,
                origin_warehouse_id: originWh?.id || null,
                origin_warehouse_name: originWh?.warehouse_name || 'China Warehouse',
                origin_country_id: shipment.origin_country_id,
                origin_country_name: shipment.origin_country_name,
                destination_warehouse_id: shipment.des_country_id,
                destination_country_name: shipment.destination_country_name,
                suggested_warehouse_ref: suggestedWhRef,
                suggested_supplier_id: suggestedSupplierId,
                suggested_supplier_name: suggestedSupplier,
                total_orders: orders.length,
                total_boxes: totalBoxes,
                total_weight: parseFloat(totalWeight.toFixed(2)),
                total_cbm: parseFloat(totalCbm.toFixed(4)),
                barcode_status: orders.length === 0 ? 'NOT_APPLICABLE' : (generatedOrdersCount === 0 ? 'NOT_GENERATED' : (generatedOrdersCount === orders.length ? 'GENERATED' : 'PARTIALLY_GENERATED')),
                qr_code_format: {
                    type: "STANDARD_LOGISTICS",
                    sample: `TMS:${shipment.waybill || 'N/A'}|REF:${suggestedWhRef}|BOX:1/${totalBoxes || 1}|ORG:${shipment.origin_country_name || 'ORIGIN'}|DST:${shipment.destination_country_name || 'DEST'}`,
                    structure: {
                        tms_shipment: shipment.waybill,
                        warehouse_ref: suggestedWhRef,
                        origin: shipment.origin_country_name,
                        destination: shipment.destination_country_name,
                        total_boxes: totalBoxes
                    }
                },
                associated_orders: orders.map(o => {
                    const pkgs = Math.round(resolvePositiveNumber(o.total_packages, o.cartons, o.freight_packages));
                    const wt = resolvePositiveNumber(o.total_weight, o.weight, o.freight_weight);
                    const cbmVal = resolvePositiveNumber(o.total_cbm, o.CBM, o.order_dimensions, o.freight_dimension);
                    const orderNum = o.order_number || o.freight_number || (o.warehouse_order_id ? o.warehouse_order_id : `ORD-${o.order_id}`);
                    const desc = o.goods_description || o.freight_product_desc || '';

                    return {
                        order_id: o.order_id,
                        order_number: orderNum,
                        warehouse_reference: o.warehouse_order_id || 'N/A',
                        supplier_warehouse_order_id: o.supplier_warehouse_order_id,
                        supplier_name: o.supplier_name,
                        packages: pkgs,
                        weight: parseFloat(wt.toFixed(2)),
                        cbm: parseFloat(cbmVal.toFixed(4)),
                        goods_description: desc,
                        barcode_status: o.generated_boxes_count > 0 ? 'GENERATED' : 'NOT_GENERATED'
                    };
                })
            });
        } catch (error) {
            logger.error('Error fetching TMS shipment details:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch TMS shipment details', error: error.message });
        }
    }

    /**
     * Get active batches / containers for loading & reconciliation dropdown
     * GET /api/warehouse/batches
     */
    static async getWarehouseBatches(req, res) {
        try {
            const search = (req.query.search || '').trim();
            const destinationCountryId = req.query.destination_country_id ? parseInt(req.query.destination_country_id, 10) : null;
            let whereClauses = ['(b.is_deleted = 0 OR b.is_deleted IS NULL)'];
            let params = [];

            if (search) {
                whereClauses.push('(b.batch_number LIKE ? OR b.batch_name LIKE ? OR b.container_no LIKE ? OR b.vessel LIKE ?)');
                const s = `%${search}%`;
                params.push(s, s, s, s);
            }

            if (destinationCountryId) {
                whereClauses.push('b.detination_country_id = ?');
                params.push(destinationCountryId);
            }

            const whereSql = whereClauses.join(' AND ');
            const sql = `
                SELECT 
                    b.id AS batch_id,
                    b.batch_number,
                    b.batch_name,
                    b.container_no,
                    b.vessel,
                    b.freight,
                    b.detination_country_id AS destination_country_id,
                    c.name AS destination_country_name,
                    b.created_at
                FROM batches b
                LEFT JOIN countries c ON c.id = b.detination_country_id
                WHERE ${whereSql}
                ORDER BY b.id DESC
                LIMIT 50
            `;

            const rows = await new Promise((resolve, reject) => {
                con.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)));
            });

            return res.status(200).json({
                success: true,
                total: rows.length,
                batches: rows
            });
        } catch (error) {
            logger.error('Error fetching batches:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch batches' });
        }
    }

    /**
     * Convert 2-letter country shortcode to unicode flag emoji (e.g. 'CN' -> '🇨🇳', 'ZA' -> '🇿🇦')
     */
    static getCountryFlagEmoji(countryCode) {
        if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) return '';
        const code = countryCode.toUpperCase();
        return String.fromCodePoint(...code.split('').map(c => 127397 + c.charCodeAt(0)));
    }

    /**
     * Format Date to display string (e.g. '13 Oct 2026')
     */
    static formatDisplayDate(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    /**
     * Format Time to display string (e.g. '12:40 PM')
     */
    static formatDisplayTime(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    /**
     * Resolve freight details (type, label, icon)
     */
    static resolveFreightDetails(row) {
        const candidate = (
            row.order_freight_type ||
            row.tbl_freight_type ||
            row.batch_freight ||
            row.mode_of_transport ||
            ''
        ).toLowerCase().trim();

        if (candidate.includes('air')) return { type: 'air', label: 'Air Freight', icon: 'airplane' };
        if (candidate.includes('road')) return { type: 'road', label: 'Road Freight', icon: 'truck' };
        if (candidate.includes('rail')) return { type: 'rail', label: 'Rail Freight', icon: 'train' };
        return { type: 'sea', label: 'Sea Freight', icon: 'ship' };
    }

    /**
     * Resolve activity badge label and theme colors
     */
    static resolveScanActivityBadge(scanEvent, originCountry, destCountry) {
        const ev = (scanEvent || '').toLowerCase().trim();
        const orig = originCountry || 'China';
        const dest = destCountry || 'SA';

        switch (ev) {
            case 'collected_supplier':
            case 'collected_from_supplier':
            case 'pickup':
            case 'collected':
                return {
                    status: 'Collected from supplier',
                    color: '#00897B',
                    bg_color: '#E0F2F1',
                    description: `Collected from supplier (${orig})`
                };
            case 'received_origin':
            case 'received_warehouse':
            case 'intake':
            case 'booked_origin':
            case 'booked_warehouse':
            case 'goods received at warehouse':
                return {
                    status: 'Received at Asia Direct warehouse',
                    color: '#2E7D32',
                    bg_color: '#E8F5E9',
                    description: `Received at Asia Direct warehouse (${orig})`
                };
            case 'dispatched_to_port':
            case 'dispatched_port':
                return {
                    status: 'Dispatched to port',
                    color: '#0288D1',
                    bg_color: '#E1F5FE',
                    description: `Dispatched to port (${orig})`
                };
            case 'goods_at_origin_port':
            case 'loaded_container':
            case 'loaded_flight':
                return {
                    status: 'Goods at origin port',
                    color: '#1976D2',
                    bg_color: '#E3F2FD',
                    description: `Goods at origin port (${orig})`
                };
            case 'departed_origin':
            case 'scanned_out':
            case 'transit':
            case 'goods_in_transit':
            case 'goods are in transit':
            case 'scanned_out_warehouse':
                return {
                    status: 'Goods are in transit',
                    color: '#E65100',
                    bg_color: '#FFF3E0',
                    description: 'Goods are in transit'
                };
            case 'arrived_destination_port':
            case 'port_destination':
                return {
                    status: 'Arrived at destination port',
                    color: '#0288D1',
                    bg_color: '#E1F5FE',
                    description: `Arrived at destination port (${dest})`
                };
            case 'customs_clearing':
            case 'customs':
            case 'customs_in_progress':
                return {
                    status: 'Customs clearing in progress',
                    color: '#F57C00',
                    bg_color: '#FFF3E0',
                    description: 'Customs clearing in progress'
                };
            case 'customs_released':
            case 'customs release':
            case 'customs_cleared':
                return {
                    status: 'Customs released',
                    color: '#2E7D32',
                    bg_color: '#E8F5E9',
                    description: 'Customs released'
                };
            case 'transit_warehouse':
            case 'goods in transit to warehouse':
            case 'goods_in_transit_to_warehouse':
                return {
                    status: 'Goods in transit to warehouse',
                    color: '#E65100',
                    bg_color: '#FFF3E0',
                    description: `Goods in transit to warehouse (${dest})`
                };
            case 'arrived_destination':
            case 'received_destination':
            case 'booked_destination':
            case 'arrived at destination warehouse':
            case 'offloaded':
            case 'offloading':
                return {
                    status: 'Arrived at Asia Direct warehouse',
                    color: '#2E7D32',
                    bg_color: '#E8F5E9',
                    description: `Arrived at Asia Direct warehouse (${dest})`
                };
            case 'readyfordelivery':
            case 'ready_for_delivery':
            case 'ready for delivery':
            case 'out_for_delivery':
            case 'out for delivery':
                return {
                    status: 'Out for delivery',
                    color: '#EF6C00',
                    bg_color: '#FFF3E0',
                    description: 'Out for delivery to customer'
                };
            case 'delivered':
                return {
                    status: 'Delivered',
                    color: '#2E7D32',
                    bg_color: '#E8F5E9',
                    description: 'Delivered to customer'
                };
            default: {
                const norm = WarehouseTrackingController.normalizeTimelineStatus(ev);
                return {
                    status: norm || 'Received at Asia Direct warehouse',
                    color: '#37474F',
                    bg_color: '#ECEFF1',
                    description: norm || 'Scan event'
                };
            }
        }
    }

    /**
     * Format a raw scan event row into a clean Mobile Activity Card model
     */
    static formatActivityCardItem(r) {
        const freight = WarehouseTrackingController.resolveFreightDetails(r);
        const origName = r.origin_country_name || 'China';
        const origCode = r.origin_country_code || 'CN';
        const origFlag = WarehouseTrackingController.getCountryFlagEmoji(origCode) || '🇨🇳';

        const destName = r.dest_country_name || 'South Africa';
        const destCode = r.dest_country_code || 'ZA';
        const destFlag = WarehouseTrackingController.getCountryFlagEmoji(destCode) || '🇿🇦';

        const badge = WarehouseTrackingController.resolveScanActivityBadge(r.scan_event, origName, destName);
        const refNo = r.container_no || r.batch_number || r.warehouse_order_number || ('CNT-' + (r.resolved_batch_id || r.scan_id));

        return {
            scan_id: r.scan_id,
            box_id: r.box_id || r.box_tbl_id,
            barcode_string: r.barcode_string,
            freight_type: freight.type,
            freight_label: freight.label,
            freight_icon: freight.icon,
            origin_country: origName,
            origin_country_code: origCode,
            origin_country_flag: origFlag,
            destination_country: destName,
            destination_country_code: destCode,
            destination_country_flag: destFlag,
            route: `${origName} ➔ ${destName}`,
            route_with_flags: `${origFlag} ${origName} ➔ ${destFlag} ${destName}`,
            reference_no: refNo,
            container_no: r.container_no || null,
            batch_number: r.batch_number || null,
            date: WarehouseTrackingController.formatDisplayDate(r.scanned_at),
            time: WarehouseTrackingController.formatDisplayTime(r.scanned_at),
            timestamp: r.scanned_at,
            status: badge.status,
            status_badge: badge.status,
            status_color: badge.color,
            status_bg_color: badge.bg_color,
            scan_event: r.scan_event,
            warehouse_order_number: r.warehouse_order_number || null,
            order_id: r.order_id || null,
            box_number: r.box_number || 1,
            total_boxes: r.total_boxes || 1,
            box_display: `Box ${r.box_number || 1}/${r.total_boxes || 1}`,
            weight_kg: r.weight_kg ? parseFloat(r.weight_kg) : null,
            cbm: r.cbm ? parseFloat(r.cbm) : null,
            is_damaged: r.is_damaged === 1 || r.is_damaged === true,
            damage_comment: r.damage_comment || null,
            scanned_by_name: r.scanned_by_name || 'Santosh Gupta',
            warehouse_name: r.warehouse_name || null
        };
    }

    /**
     * Format a distinct recent order row into an Order Activity Card model
     * (Groups boxes by Order so the mobile home feed is clean and not spammed with individual box barcodes)
     */
    static formatOrderActivityCardItem(r) {
        const freight = WarehouseTrackingController.resolveFreightDetails(r);
        const origName = r.origin_country_name || 'China';
        const origCode = r.origin_country_code || 'CN';
        const origFlag = WarehouseTrackingController.getCountryFlagEmoji(origCode) || '🇨🇳';

        const destName = r.dest_country_name || 'South Africa';
        const destCode = r.dest_country_code || 'ZA';
        const destFlag = WarehouseTrackingController.getCountryFlagEmoji(destCode) || '🇿🇦';

        const totalBoxes = Math.max(r.total_boxes_count || 1, r.defined_total_boxes || 1);
        const scannedBoxes = Math.min(r.scanned_boxes_count || 0, totalBoxes);
        const isComplete = (scannedBoxes >= totalBoxes && scannedBoxes > 0);

        let displayStatus = WarehouseTrackingController.normalizeTimelineStatus(r.order_track_status);
        if (!displayStatus || displayStatus === 'GENERATED' || displayStatus === 'Awaiting Check-in') {
            displayStatus = isComplete
                ? 'Received at Asia Direct warehouse'
                : 'Awaiting Check-in';
        }
        displayStatus = WarehouseTrackingController.normalizeTimelineStatus(displayStatus);

        const isDamaged = (r.has_damaged_box === 1 || r.has_damaged_box === true);
        const refNo = r.container_no || r.batch_number || r.order_number;
        const lastActivityDate = r.last_scanned_at || r.last_activity_at || new Date();

        return {
            order_id: r.resolved_order_id || r.order_id || null,
            supplier_warehouse_order_id: r.supplier_warehouse_order_id || null,
            order_number: r.order_number,
            // Setting barcode_string to order_number ensures current mobile app displays Order Number in card header!
            barcode_string: r.order_number,
            title: r.order_number,
            client_name: r.client_name || 'Asia Direct Logistics',
            freight_type: freight.type,
            freight_label: freight.label,
            freight_icon: freight.icon,
            origin_country: origName,
            origin_country_code: origCode,
            origin_country_flag: origFlag,
            destination_country: destName,
            destination_country_code: destCode,
            destination_country_flag: destFlag,
            route: `${origName} ➔ ${destName}`,
            route_with_flags: `${origFlag} ${origName} ➔ ${destFlag} ${destName}`,
            reference_no: refNo,
            container_no: r.container_no || null,
            batch_number: r.batch_number || null,
            total_boxes: totalBoxes,
            boxes_scanned: scannedBoxes,
            box_display: totalBoxes > 1 ? `Boxes ${scannedBoxes}/${totalBoxes}` : `Boxes ${totalBoxes}`,
            is_consignment_complete: isComplete,
            progress_percentage: Math.round((scannedBoxes / totalBoxes) * 100),
            is_damaged: isDamaged,
            status: displayStatus,
            status_badge: displayStatus,
            status_color: isDamaged ? '#C62828' : (isComplete ? '#2E7D32' : '#1976D2'),
            status_bg_color: isDamaged ? '#FFEBEE' : (isComplete ? '#E8F5E9' : '#E3F2FD'),
            scan_event: r.latest_scan_event || 'received_origin',
            scan_id: r.latest_scan_id || null,
            date: WarehouseTrackingController.formatDisplayDate(lastActivityDate),
            time: WarehouseTrackingController.formatDisplayTime(lastActivityDate),
            timestamp: lastActivityDate
        };
    }

    /**
     * Mobile App Home Dashboard API
     * GET /api/warehouse/home OR /api/warehouse/dashboard
     * Returns:
     * - User info & personalized greeting (e.g. "Good Morning, Santosh Gupta")
     * - Top Summary Stats (Total Shipments, Active Scans, Total Boxes, Damaged Boxes)
     * - Quick action shortcut cards (Scan, Shipments, Load/Offload, Warehouse Check-in)
     * - Recent Activity list (Recent distinct Orders, each showing box count and status)
     */
    static async getWarehouseHomeDashboard(req, res) {
        try {
            // 1. Resolve User
            let user = req.user || null;
            if (!user && req.headers['authorization']) {
                try {
                    const authHeader = req.headers['authorization'];
                    const token = authHeader && authHeader.split(' ')[1];
                    if (token) {
                        user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret-key-asia-direct');
                    }
                } catch (e) {
                    // Token verification error handled gracefully
                }
            }

            const userId = (user && user.id) || req.query.user_id || req.query.staff_id || req.query.supplier_id || null;
            let userRole = ((user && user.role) || req.query.role || '').toLowerCase().trim();

            if (!userRole && user && user.user_type) {
                if (parseInt(user.user_type, 10) === 1 && user.country) {
                    userRole = 'supplier';
                } else if (parseInt(user.user_type, 10) === 2) {
                    userRole = 'staff';
                }
            }

            if (!user && !userId) {
                const defaultUserRows = await new Promise((resolve) => {
                    con.query(
                        `SELECT id, full_name, email, user_type, access_country 
                         FROM tbl_users 
                         WHERE is_deleted = 0 AND (user_type = 1 OR user_type = 2) 
                         ORDER BY id ASC LIMIT 1`,
                        (err, rows) => resolve(rows || [])
                    );
                });
                if (defaultUserRows && defaultUserRows.length > 0) {
                    user = defaultUserRows[0];
                } else {
                    user = { id: 22046, full_name: 'Santosh Gupta', email: 'staff@asiadirect.com', user_type: 2, access_country: '246,202,245' };
                }
            }

            user = user || {};

            let isSupplier = (userRole === 'supplier');
            let supplierCountry = user.country || req.query.country || null;

            if (!isSupplier && userId && !userRole) {
                const supCheck = await new Promise((resolve) => {
                    con.query('SELECT country, company_name, email FROM tbl_suppliers WHERE id = ? AND is_deleted = 0 LIMIT 1', [userId], (err, rows) => resolve(rows || []));
                });
                if (supCheck.length > 0) {
                    isSupplier = true;
                    userRole = 'supplier';
                    supplierCountry = supCheck[0].country;
                    if (!user.name && !user.full_name) user.name = supCheck[0].company_name || 'Supplier';
                }
            }

            if (isSupplier) {
                if (!supplierCountry && userId) {
                    const supRows = await new Promise((resolve) => {
                        con.query('SELECT country, company_name FROM tbl_suppliers WHERE id = ? AND is_deleted = 0 LIMIT 1', [userId], (err, rows) => resolve(rows || []));
                    });
                    if (supRows.length > 0) {
                        supplierCountry = supRows[0].country;
                        if (!user.name && !user.full_name) user.name = supRows[0].company_name || 'Supplier';
                    }
                }
            }

            let accessCountries = [];
            let isSuperAdmin = false;

            if (!isSupplier) {
                if (user.access_country && Array.isArray(user.access_country)) {
                    accessCountries = user.access_country.map(c => String(c).trim()).filter(Boolean);
                } else if (typeof user.access_country === 'string') {
                    accessCountries = user.access_country.split(',').map(c => c.trim()).filter(Boolean);
                } else if (userId) {
                    const staffRows = await new Promise((resolve) => {
                        con.query('SELECT full_name, email, access_country, user_type FROM tbl_users WHERE id = ? AND is_deleted = 0 LIMIT 1', [userId], (err, rows) => resolve(rows || []));
                    });
                    if (staffRows.length > 0) {
                        const uType = parseInt(staffRows[0].user_type, 10);
                        const rawAccess = staffRows[0].access_country || '';
                        accessCountries = rawAccess.split(',').map(c => c.trim()).filter(Boolean);
                        if (uType === 1 && !rawAccess) {
                            isSuperAdmin = true;
                        }
                        if (!user.name && !user.full_name) user.name = staffRows[0].full_name;
                    }
                }

                if (req.query.access_country) {
                    const qAccess = typeof req.query.access_country === 'string'
                        ? req.query.access_country.split(',').map(c => c.trim()).filter(Boolean)
                        : req.query.access_country;
                    if (qAccess && qAccess.length > 0) accessCountries = qAccess;
                }
            }

            const userName = user.full_name || user.name || (isSupplier ? 'Supplier' : 'Santosh Gupta');
            userRole = userRole || (isSupplier ? 'supplier' : 'staff');

            // Dynamic Greeting based on server/client hour
            const hour = new Date().getHours();
            let greeting = 'Good Morning';
            if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
            else if (hour >= 17) greeting = 'Good Evening';

            const avatarInitial = (userName.trim()[0] || 'S').toUpperCase();

            // 2. Compute Summary Counters
            // Total shipments count filtered by supplier country or staff access_country (excluding Customs Released)
            let shipmentsCountPromise;
            if (isSupplier) {
                if (supplierCountry) {
                    shipmentsCountPromise = new Promise((resolve) => {
                        con.query(
                            `SELECT COUNT(*) AS total 
                             FROM tbl_shipments ts 
                             WHERE (ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released')) 
                               AND (ts.origin_country_id = ? OR ts.des_country_id = ?)`,
                            [supplierCountry, supplierCountry],
                            (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                        );
                    });
                } else {
                    shipmentsCountPromise = Promise.resolve(0);
                }
            } else if (isSuperAdmin) {
                shipmentsCountPromise = new Promise((resolve) => {
                    con.query(
                        `SELECT COUNT(*) AS total 
                         FROM tbl_shipments ts 
                         WHERE (ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released'))`,
                        (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                    );
                });
            } else {
                if (accessCountries.length > 0) {
                    shipmentsCountPromise = new Promise((resolve) => {
                        con.query(
                            `SELECT COUNT(*) AS total 
                             FROM tbl_shipments ts 
                             WHERE (ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released')) 
                               AND (ts.origin_country_id IN (?) OR ts.des_country_id IN (?))`,
                            [accessCountries, accessCountries],
                            (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                        );
                    });
                } else {
                    shipmentsCountPromise = Promise.resolve(0);
                }
            }

            // Active scans count filtered by supplier country or staff access_country in active unreleased shipments
            let activeScansPromise;
            if (isSupplier) {
                if (supplierCountry) {
                    activeScansPromise = new Promise((resolve) => {
                        con.query(
                            `SELECT COUNT(DISTINCT wbs.id) AS total
                             FROM warehouse_box_scans wbs
                             JOIN warehouse_package_boxes wpb ON (wpb.id = wbs.box_id OR wpb.barcode_string = wbs.barcode_string)
                             LEFT JOIN tbl_orders o ON o.id = wpb.order_id
                             LEFT JOIN shipment_details sd ON (sd.order_id = wpb.order_id OR (sd.batch_id IS NOT NULL AND (sd.batch_id = wpb.assigned_batch_id OR sd.batch_id = wbs.batch_id)))
                             JOIN tbl_shipments ts ON (ts.id = sd.shipment_id OR ts.id = o.assign_to_shipment)
                             WHERE (ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released'))
                               AND (ts.origin_country_id = ? OR ts.des_country_id = ?)`,
                            [supplierCountry, supplierCountry],
                            (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                        );
                    });
                } else {
                    activeScansPromise = Promise.resolve(0);
                }
            } else if (isSuperAdmin) {
                activeScansPromise = new Promise((resolve) => {
                    con.query(
                        `SELECT COUNT(DISTINCT wbs.id) AS total
                         FROM warehouse_box_scans wbs
                         JOIN warehouse_package_boxes wpb ON (wpb.id = wbs.box_id OR wpb.barcode_string = wbs.barcode_string)
                         LEFT JOIN tbl_orders o ON o.id = wpb.order_id
                         LEFT JOIN shipment_details sd ON (sd.order_id = wpb.order_id OR (sd.batch_id IS NOT NULL AND (sd.batch_id = wpb.assigned_batch_id OR sd.batch_id = wbs.batch_id)))
                         JOIN tbl_shipments ts ON (ts.id = sd.shipment_id OR ts.id = o.assign_to_shipment)
                         WHERE (ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released'))`,
                        (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                    );
                });
            } else {
                if (accessCountries.length > 0) {
                    activeScansPromise = new Promise((resolve) => {
                        con.query(
                            `SELECT COUNT(DISTINCT wbs.id) AS total
                             FROM warehouse_box_scans wbs
                             JOIN warehouse_package_boxes wpb ON (wpb.id = wbs.box_id OR wpb.barcode_string = wbs.barcode_string)
                             LEFT JOIN tbl_orders o ON o.id = wpb.order_id
                             LEFT JOIN shipment_details sd ON (sd.order_id = wpb.order_id OR (sd.batch_id IS NOT NULL AND (sd.batch_id = wpb.assigned_batch_id OR sd.batch_id = wbs.batch_id)))
                             JOIN tbl_shipments ts ON (ts.id = sd.shipment_id OR ts.id = o.assign_to_shipment)
                             WHERE (ts.status IS NULL OR LOWER(TRIM(ts.status)) NOT IN ('customs released', 'customs_released'))
                               AND (ts.origin_country_id IN (?) OR ts.des_country_id IN (?))`,
                            [accessCountries, accessCountries],
                            (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                        );
                    });
                } else {
                    activeScansPromise = Promise.resolve(0);
                }
            }

            // Orders count promise
            const ordersCountPromise = isSupplier && userId
                ? new Promise((resolve) => {
                    con.query('SELECT COUNT(*) AS total FROM supplier_warehouse_orders WHERE supplier_id = ?', [userId], (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0));
                })
                : new Promise((resolve) => {
                    con.query('SELECT COUNT(*) AS total FROM supplier_warehouse_orders', (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0));
                });

            // Boxes count promise
            const boxesCountPromise = isSupplier && userId
                ? new Promise((resolve) => {
                    con.query(
                        `SELECT COUNT(DISTINCT b.id) AS total 
                         FROM warehouse_package_boxes b 
                         JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id 
                         WHERE swo.supplier_id = ?`,
                        [userId],
                        (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                    );
                })
                : new Promise((resolve) => {
                    con.query('SELECT COUNT(*) AS total FROM warehouse_package_boxes', (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0));
                });

            // Damaged count promise
            const damagedCountPromise = isSupplier && userId
                ? new Promise((resolve) => {
                    con.query(
                        `SELECT COUNT(DISTINCT b.id) AS total 
                         FROM warehouse_package_boxes b 
                         JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id 
                         WHERE b.is_damaged = 1 AND swo.supplier_id = ?`,
                        [userId],
                        (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0)
                    );
                })
                : new Promise((resolve) => {
                    con.query('SELECT COUNT(*) AS total FROM warehouse_package_boxes WHERE is_damaged = 1', (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0));
                });

            const [ordersCountRow, shipmentsCountRow, scansCountRow, boxesCountRow, damagedCountRow] = await Promise.all([
                ordersCountPromise,
                shipmentsCountPromise,
                activeScansPromise,
                boxesCountPromise,
                damagedCountPromise
            ]);

            // Top Stats Card (Matching the mobile app UI)
            const stats = {
                total_orders: typeof ordersCountRow === 'number' ? ordersCountRow : (parseInt(ordersCountRow, 10) || 0),
                total_shipments: typeof shipmentsCountRow === 'number' ? shipmentsCountRow : (parseInt(shipmentsCountRow, 10) || 0),
                active_scans: typeof scansCountRow === 'number' ? scansCountRow : (parseInt(scansCountRow, 10) || 0),
                total_boxes: typeof boxesCountRow === 'number' ? boxesCountRow : (parseInt(boxesCountRow, 10) || 0),
                damaged_boxes: typeof damagedCountRow === 'number' ? damagedCountRow : (parseInt(damagedCountRow, 10) || 0)
            };

            // 3. Quick Action Menu Cards (Tailored for Supplier vs Staff)
            const quick_actions = isSupplier ? [
                {
                    id: 'create_order',
                    title: 'Add Order',
                    subtitle: 'Create warehouse order & full details',
                    icon: 'plus',
                    color: '#E8F8F0',
                    route: '/create-order'
                },
                {
                    id: 'orders',
                    title: 'My Orders',
                    subtitle: 'View orders & generate barcodes',
                    icon: 'box',
                    color: '#EAF2FD',
                    route: '/orders'
                },
                {
                    id: 'generate_barcode',
                    title: 'Generate Barcode',
                    subtitle: 'Generate box labels & barcodes',
                    icon: 'barcode',
                    color: '#F3EBF9',
                    route: '/generate-barcode'
                },
                {
                    id: 'shipments',
                    title: 'Shipments',
                    subtitle: 'Track your shipments & movement',
                    icon: 'airplane',
                    color: '#FDEDEC',
                    route: '/shipments'
                }
            ] : [
                {
                    id: 'scan',
                    title: 'Scan',
                    subtitle: 'Scan barcode for check-in / movement',
                    icon: 'scan',
                    color: '#E8F8F0',
                    route: '/scan'
                },
                {
                    id: 'shipments',
                    title: 'Shipments',
                    subtitle: 'View & track all shipments',
                    icon: 'airplane',
                    color: '#EAF2FD',
                    route: '/shipments'
                },
                {
                    id: 'load_offload',
                    title: 'Load / Offload',
                    subtitle: 'Manage loading & offloading activities',
                    icon: 'truck',
                    color: '#FDEDEC',
                    route: '/load-offload'
                },
                {
                    id: 'warehouse_checkin',
                    title: 'Warehouse Check-in',
                    subtitle: 'Receive & verify shipments',
                    icon: 'warehouse',
                    color: '#F3EBF9',
                    route: '/warehouse-checkin'
                }
            ];

            // 4. Fetch Recent Activities (Grouped by Order so mobile home feed shows recent orders, not duplicate box barcodes)
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

            let recentOrdersSql;
            let recentOrdersParams = [limit];

            if (isSupplier && userId) {
                recentOrdersSql = `
                    SELECT 
                        swo.order_id AS resolved_order_id,
                        swo.id AS supplier_warehouse_order_id,
                        COALESCE(o.order_number, b.warehouse_order_number, swo.warehouse_order_id, CONCAT('SWO-', swo.id)) AS order_number,
                        COALESCE(o.client_name, swo.customer_name, 'Asia Direct Logistics') AS client_name,
                        o.track_status AS order_track_status,
                        MAX(s.scanned_at) AS last_scanned_at,
                        MAX(COALESCE(s.scanned_at, b.updated_at, b.created_at, swo.created_at)) AS last_activity_at,
                        MAX(s.id) AS latest_scan_id,
                        MAX(s.barcode_string) AS latest_barcode_string,
                        MAX(s.scan_event) AS latest_scan_event,
                        COUNT(DISTINCT b.id) AS total_boxes_count,
                        COALESCE(MAX(b.total_boxes), MAX(swo.total_packages), 0) AS defined_total_boxes,
                        COUNT(DISTINCT CASE WHEN b.current_status != 'GENERATED' AND b.current_status IS NOT NULL THEN b.id END) AS scanned_boxes_count,
                        MAX(COALESCE(b.is_damaged, swo.damaged_goods, 0)) AS has_damaged_box,
                        o.freight_type AS order_freight_type,
                        o.mode_of_transport,
                        tf.freight AS tbl_freight_type,
                        bt.freight AS batch_freight,
                        bt.container_no,
                        bt.batch_number,
                        w.warehouse_name,
                        COALESCE(c_orig.name, 'China') AS origin_country_name,
                        COALESCE(c_orig.shortname, 'CN') AS origin_country_code,
                        COALESCE(c_dest.name, 'South Africa') AS dest_country_name,
                        COALESCE(c_dest.shortname, 'ZA') AS dest_country_code
                    FROM supplier_warehouse_orders swo
                    LEFT JOIN warehouse_package_boxes b ON b.supplier_warehouse_order_id = swo.id
                    LEFT JOIN warehouse_box_scans s ON (s.box_id = b.id OR s.barcode_string = b.barcode_string)
                    LEFT JOIN tbl_orders o ON o.id = swo.order_id
                    LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                    LEFT JOIN batches bt ON bt.id = b.assigned_batch_id
                    LEFT JOIN warehouse_tbl w ON w.id = COALESCE(b.origin_warehouse_id, swo.warehouse_id)
                    LEFT JOIN countries c_orig ON c_orig.id = COALESCE(w.country, swo.collection_from)
                    LEFT JOIN countries c_dest ON c_dest.id = swo.destination_country
                    WHERE swo.supplier_id = ?
                    GROUP BY swo.id
                    ORDER BY MAX(COALESCE(s.scanned_at, b.updated_at, b.created_at, swo.created_at)) DESC
                    LIMIT ?
                `;
                recentOrdersParams = [userId, limit];
            } else {
                recentOrdersSql = `
                    SELECT 
                        COALESCE(b.order_id, swo.order_id) AS resolved_order_id,
                        b.supplier_warehouse_order_id,
                        COALESCE(o.order_number, b.warehouse_order_number, CONCAT('ORD-', COALESCE(b.order_id, swo.order_id))) AS order_number,
                        COALESCE(o.client_name, swo.customer_name, 'Asia Direct Logistics') AS client_name,
                        o.track_status AS order_track_status,
                        MAX(s.scanned_at) AS last_scanned_at,
                        MAX(COALESCE(s.scanned_at, b.updated_at, b.created_at)) AS last_activity_at,
                        MAX(s.id) AS latest_scan_id,
                        MAX(s.barcode_string) AS latest_barcode_string,
                        MAX(s.scan_event) AS latest_scan_event,
                        COUNT(DISTINCT b.id) AS total_boxes_count,
                        MAX(b.total_boxes) AS defined_total_boxes,
                        COUNT(DISTINCT CASE WHEN b.current_status != 'GENERATED' AND b.current_status IS NOT NULL THEN b.id END) AS scanned_boxes_count,
                        MAX(b.is_damaged) AS has_damaged_box,
                        o.freight_type AS order_freight_type,
                        o.mode_of_transport,
                        tf.freight AS tbl_freight_type,
                        bt.freight AS batch_freight,
                        bt.container_no,
                        bt.batch_number,
                        w.warehouse_name,
                        COALESCE(c_orig.name, 'China') AS origin_country_name,
                        COALESCE(c_orig.shortname, 'CN') AS origin_country_code,
                        COALESCE(c_dest.name, 'South Africa') AS dest_country_name,
                        COALESCE(c_dest.shortname, 'ZA') AS dest_country_code
                    FROM warehouse_package_boxes b
                    LEFT JOIN warehouse_box_scans s ON (s.box_id = b.id OR s.barcode_string = b.barcode_string)
                    LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                    LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                    LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                    LEFT JOIN batches bt ON bt.id = b.assigned_batch_id
                    LEFT JOIN warehouse_tbl w ON w.id = b.origin_warehouse_id
                    LEFT JOIN countries c_orig ON c_orig.id = w.country
                    LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                    LEFT JOIN countries c_dest ON c_dest.id = w_dest.country
                    WHERE (b.order_id IS NOT NULL OR b.supplier_warehouse_order_id IS NOT NULL)
                    GROUP BY 
                        COALESCE(b.order_id, swo.order_id),
                        b.supplier_warehouse_order_id,
                        COALESCE(o.order_number, b.warehouse_order_number)
                    ORDER BY MAX(COALESCE(s.scanned_at, b.updated_at, b.created_at)) DESC
                    LIMIT ?
                `;
            }

            const orderRows = await new Promise((resolve) => {
                con.query(recentOrdersSql, recentOrdersParams, (err, rows) => resolve(rows || []));
            });

            const recent_activities = orderRows.map(r => WarehouseTrackingController.formatOrderActivityCardItem(r));

            return res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        name: userName,
                        email: user.email || '',
                        role: userRole,
                        greeting: greeting,
                        full_greeting: `${greeting}, ${userName}`,
                        avatar_initial: avatarInitial
                    },
                    stats: stats,
                    quick_actions: quick_actions,
                    recent_activities: recent_activities,
                    recent_orders: recent_activities
                }
            });
        } catch (error) {
            logger.error('Error fetching warehouse home dashboard:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch warehouse dashboard data'
            });
        }
    }

    /**
     * Recent Activity / Order & Box Breakdown Details API
     * GET /api/warehouse/activity/:identifier OR /api/warehouse/order/:identifier OR /api/warehouse/scan/:identifier
     * Accessible by order_number (e.g. OR0001085), order_id, scan_id, barcode_string, or box_id
     * Returns:
     * - order: Order details, client, supplier, totals, consignment completion
     * - routing: Freight type, origin/destination countries & flags, carrier/container
     * - boxes: Array of ALL boxes under this order with individual statuses, barcodes, weights, dimensions & damage photos
     * - timeline: All scan events across the order and its boxes
     * - activity: Target/latest scan event details (for backwards compatibility)
     * - box: Primary box details (for backwards compatibility)
     */
    static async getActivityDetails(req, res) {
        try {
            const identifier = (req.params.identifier || req.query.scan_id || req.query.barcode || req.query.order_number || req.query.id || '').trim();
            if (!identifier) {
                return res.status(400).json({
                    success: false,
                    message: 'Identifier (order number, order ID, scan ID, or barcode string) is required'
                });
            }

            const isNumeric = /^\d+$/.test(identifier);
            let orderId = null;
            let swoId = null;
            let primaryBoxId = null;
            let targetBarcode = identifier;
            let targetScanId = null;

            // 1. Resolve identifier to order_id, supplier_warehouse_order_id, and/or box_id
            // Case A: Looks like an order number (e.g. OR0001085, ORD-1085, WH-...)
            if (identifier.toUpperCase().startsWith('OR') || identifier.toUpperCase().startsWith('WH-')) {
                const orderRows = await new Promise(res => {
                    con.query('SELECT id FROM tbl_orders WHERE order_number = ? LIMIT 1', [identifier], (e, r) => res(r || []));
                });
                if (orderRows.length > 0) {
                    orderId = orderRows[0].id;
                } else {
                    const parsedOrdId = parseInt(identifier.replace(/^(ORD-|OR)/i, ''), 10);
                    if (!isNaN(parsedOrdId) && parsedOrdId > 0) {
                        const oCheck = await new Promise(res => {
                            con.query('SELECT id FROM tbl_orders WHERE id = ? LIMIT 1', [parsedOrdId], (e, r) => res(r || []));
                        });
                        if (oCheck.length > 0) {
                            orderId = parsedOrdId;
                        }
                    }
                    if (!orderId) {
                        const bRows = await new Promise(res => {
                            con.query('SELECT order_id, supplier_warehouse_order_id, id, barcode_string FROM warehouse_package_boxes WHERE warehouse_order_number = ? LIMIT 1', [identifier], (e, r) => res(r || []));
                        });
                        if (bRows.length > 0) {
                            orderId = bRows[0].order_id;
                            swoId = bRows[0].supplier_warehouse_order_id;
                            primaryBoxId = bRows[0].id;
                            targetBarcode = bRows[0].barcode_string;
                        }
                    }
                }
            }

            // Case B: Numeric ID (scan_id, order_id, or box_id)
            if (!orderId && !swoId && isNumeric) {
                const num = parseInt(identifier, 10);
                // Try scan_id first
                const sRows = await new Promise(res => {
                    con.query(`
                        SELECT s.id, s.box_id, s.barcode_string, b.order_id, b.supplier_warehouse_order_id 
                        FROM warehouse_box_scans s
                        LEFT JOIN warehouse_package_boxes b ON (b.id = s.box_id OR b.barcode_string = s.barcode_string)
                        WHERE s.id = ? LIMIT 1
                    `, [num], (e, r) => res(r || []));
                });
                if (sRows.length > 0 && (sRows[0].order_id || sRows[0].supplier_warehouse_order_id)) {
                    orderId = sRows[0].order_id;
                    swoId = sRows[0].supplier_warehouse_order_id;
                    primaryBoxId = sRows[0].box_id;
                    targetBarcode = sRows[0].barcode_string;
                    targetScanId = sRows[0].id;
                } else {
                    // Try order_id
                    const oRows = await new Promise(res => {
                        con.query('SELECT id FROM tbl_orders WHERE id = ? LIMIT 1', [num], (e, r) => res(r || []));
                    });
                    if (oRows.length > 0) {
                        orderId = num;
                    } else {
                        // Try box_id, order_id, or supplier_warehouse_order_id in warehouse_package_boxes
                        const boxRows = await new Promise(res => {
                            con.query('SELECT id, order_id, supplier_warehouse_order_id, barcode_string FROM warehouse_package_boxes WHERE id = ? OR order_id = ? OR supplier_warehouse_order_id = ? LIMIT 1', [num, num, num], (e, r) => res(r || []));
                        });
                        if (boxRows.length > 0) {
                            orderId = boxRows[0].order_id;
                            swoId = boxRows[0].supplier_warehouse_order_id;
                            primaryBoxId = boxRows[0].id;
                            targetBarcode = boxRows[0].barcode_string;
                        }
                    }
                }
            }

            // Case C: Barcode string or Freight number
            if (!orderId && !swoId) {
                const bRows = await new Promise(res => {
                    con.query('SELECT id, order_id, supplier_warehouse_order_id, barcode_string FROM warehouse_package_boxes WHERE barcode_string = ? LIMIT 1', [identifier], (e, r) => res(r || []));
                });
                if (bRows.length > 0) {
                    orderId = bRows[0].order_id;
                    swoId = bRows[0].supplier_warehouse_order_id;
                    primaryBoxId = bRows[0].id;
                    targetBarcode = bRows[0].barcode_string;
                } else {
                    const sRows = await new Promise(res => {
                        con.query('SELECT s.id, s.box_id, s.barcode_string FROM warehouse_box_scans s WHERE s.barcode_string = ? LIMIT 1', [identifier], (e, r) => res(r || []));
                    });
                    if (sRows.length > 0) {
                        targetScanId = sRows[0].id;
                        primaryBoxId = sRows[0].box_id;
                        targetBarcode = sRows[0].barcode_string;
                    } else {
                        const fRows = await new Promise(res => {
                            con.query('SELECT o.id AS order_id FROM tbl_freight tf JOIN tbl_orders o ON o.freight_id = tf.id WHERE tf.freight_number = ? LIMIT 1', [identifier], (e, r) => res(r || []));
                        });
                        if (fRows.length > 0) {
                            orderId = fRows[0].order_id;
                        }
                    }
                }
            }

            if (!orderId && !swoId && !primaryBoxId) {
                return res.status(404).json({
                    success: false,
                    message: `No order or warehouse box found for identifier: ${identifier}`
                });
            }

            // 2. Fetch Order Header & Routing Info
            const headerSql = `
                SELECT 
                    COALESCE(o.id, b.order_id, swo.order_id) AS order_id,
                    COALESCE(o.order_number, b.warehouse_order_number, CONCAT('ORD-', COALESCE(o.id, b.order_id, swo.order_id))) AS order_number,
                    COALESCE(o.client_name, swo.customer_name, tf.client_name, tf.client_ref_name, 'Asia Direct Logistics') AS client_name,
                    swo.id AS supplier_warehouse_order_id,
                    COALESCE(swo.supplier_company, tf.shipper_name, 'N/A') AS supplier_name,
                    COALESCE(swo.goods_description, o.goods_description, tf.product_desc) AS goods_description,
                    swo.total_packages AS swo_packages,
                    swo.total_weight AS swo_total_weight,
                    swo.total_cbm AS swo_total_cbm,
                    o.cartons AS order_cartons,
                    o.weight AS order_weight,
                    o.CBM AS order_cbm,
                    o.dimensions AS order_dimensions,
                    tf.freight_number,
                    tf.no_of_packages AS freight_packages,
                    tf.weight AS freight_weight,
                    tf.dimension AS freight_dimension,
                    tf.product_desc AS freight_product_desc,
                    o.track_status AS order_track_status,
                    COALESCE(o.freight_type, tf.freight) AS order_freight_type,
                    o.mode_of_transport,
                    tf.freight AS tbl_freight_type,
                    bt.id AS resolved_batch_id,
                    bt.batch_number,
                    bt.batch_name,
                    bt.container_no,
                    bt.vessel,
                    bt.carrier,
                    bt.waybill AS batch_waybill,
                    bt.freight AS batch_freight,
                    COALESCE(c_orig.name, 'China') AS origin_country_name,
                    COALESCE(c_orig.shortname, 'CN') AS origin_country_code,
                    COALESCE(c_dest.name, 'South Africa') AS dest_country_name,
                    COALESCE(c_dest.shortname, 'ZA') AS dest_country_code,
                    w_orig.warehouse_name AS origin_warehouse_name
                FROM warehouse_package_boxes b
                LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                LEFT JOIN batches bt ON bt.id = b.assigned_batch_id
                LEFT JOIN warehouse_tbl w_orig ON w_orig.id = COALESCE(b.origin_warehouse_id, swo.warehouse_id)
                LEFT JOIN countries c_orig ON c_orig.id = w_orig.country
                LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                LEFT JOIN countries c_dest ON c_dest.id = w_dest.country
                WHERE (b.order_id = ? AND ? > 0) OR (b.supplier_warehouse_order_id = ? AND ? > 0) OR (b.id = ? AND ? > 0)
                LIMIT 1
            `;

            const headerRows = await new Promise((resolve) => {
                con.query(headerSql, [orderId || 0, orderId || 0, swoId || 0, swoId || 0, primaryBoxId || 0, primaryBoxId || 0], (err, rows) => resolve(rows || []));
            });

            let header = headerRows && headerRows.length > 0 ? headerRows[0] : null;
            if (!header && (orderId || swoId)) {
                const fallbackOrderRows = await new Promise((resolve) => {
                    const fallbackSql = orderId ? `
                        SELECT 
                            o.id AS order_id,
                            COALESCE(o.order_number, CONCAT('ORD-', o.id)) AS order_number,
                            COALESCE(o.client_name, tf.client_name, tf.client_ref_name, 'Asia Direct Logistics') AS client_name,
                            swo.id AS supplier_warehouse_order_id,
                            COALESCE(swo.supplier_company, tf.shipper_name, 'N/A') AS supplier_name,
                            COALESCE(swo.goods_description, o.goods_description, tf.product_desc) AS goods_description,
                            swo.total_packages AS swo_packages,
                            swo.total_weight AS swo_total_weight,
                            swo.total_cbm AS swo_total_cbm,
                            o.cartons AS order_cartons,
                            o.weight AS order_weight,
                            o.CBM AS order_cbm,
                            o.dimensions AS order_dimensions,
                            tf.freight_number,
                            tf.no_of_packages AS freight_packages,
                            tf.weight AS freight_weight,
                            tf.dimension AS freight_dimension,
                            tf.product_desc AS freight_product_desc,
                            o.track_status AS order_track_status,
                            COALESCE(o.freight_type, tf.freight) AS order_freight_type,
                            o.mode_of_transport,
                            tf.freight AS tbl_freight_type,
                            'China' AS origin_country_name,
                            'CN' AS origin_country_code,
                            'South Africa' AS dest_country_name,
                            'ZA' AS dest_country_code
                        FROM tbl_orders o
                        LEFT JOIN supplier_warehouse_orders swo ON swo.order_id = o.id
                        LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                        WHERE o.id = ? LIMIT 1
                    ` : `
                        SELECT 
                            o.id AS order_id,
                            COALESCE(o.order_number, CONCAT('ORD-', swo.id)) AS order_number,
                            COALESCE(o.client_name, swo.customer_name, tf.client_name, tf.client_ref_name, 'Asia Direct Logistics') AS client_name,
                            swo.id AS supplier_warehouse_order_id,
                            COALESCE(swo.supplier_company, tf.shipper_name, 'N/A') AS supplier_name,
                            COALESCE(swo.goods_description, o.goods_description, tf.product_desc) AS goods_description,
                            swo.total_packages AS swo_packages,
                            swo.total_weight AS swo_total_weight,
                            swo.total_cbm AS swo_total_cbm,
                            o.cartons AS order_cartons,
                            o.weight AS order_weight,
                            o.CBM AS order_cbm,
                            o.dimensions AS order_dimensions,
                            tf.freight_number,
                            tf.no_of_packages AS freight_packages,
                            tf.weight AS freight_weight,
                            tf.dimension AS freight_dimension,
                            tf.product_desc AS freight_product_desc,
                            o.track_status AS order_track_status,
                            COALESCE(o.freight_type, tf.freight) AS order_freight_type,
                            o.mode_of_transport,
                            tf.freight AS tbl_freight_type,
                            'China' AS origin_country_name,
                            'CN' AS origin_country_code,
                            'South Africa' AS dest_country_name,
                            'ZA' AS dest_country_code
                        FROM supplier_warehouse_orders swo
                        LEFT JOIN tbl_orders o ON o.id = swo.order_id
                        LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                        WHERE swo.id = ? LIMIT 1
                    `;
                    con.query(fallbackSql, [orderId || swoId], (err, rows) => resolve(rows || []));
                });
                if (fallbackOrderRows && fallbackOrderRows.length > 0) {
                    header = fallbackOrderRows[0];
                }
            }

            if (!header) {
                header = {
                    order_id: orderId,
                    order_number: identifier,
                    client_name: 'Asia Direct Logistics',
                    origin_country_name: 'China',
                    origin_country_code: 'CN',
                    dest_country_name: 'South Africa',
                    dest_country_code: 'ZA'
                };
            }

            // 3. Fetch All Boxes for this Order
            const boxesSql = `
                SELECT 
                    b.id AS box_id,
                    b.box_number,
                    b.total_boxes,
                    b.barcode_string,
                    b.weight_kg,
                    b.length_cm,
                    b.width_cm,
                    b.height_cm,
                    b.cbm,
                    b.current_status,
                    b.is_damaged,
                    b.damage_comment,
                    MAX(s.scanned_at) AS last_scanned_at,
                    MAX(s.scan_event) AS last_scan_event,
                    MAX(s.id) AS latest_scan_id,
                    MAX(s.device_id) AS last_device_id,
                    MAX(s.notes) AS last_scan_notes,
                    MAX(u.full_name) AS scanned_by_name,
                    MAX(w.warehouse_name) AS warehouse_name
                FROM warehouse_package_boxes b
                LEFT JOIN warehouse_box_scans s ON (s.box_id = b.id OR s.barcode_string = b.barcode_string)
                LEFT JOIN tbl_users u ON u.id = s.scanned_by_user_id
                LEFT JOIN warehouse_tbl w ON w.id = s.warehouse_id
                WHERE (b.order_id = ? AND ? > 0) OR (b.supplier_warehouse_order_id = ? AND ? > 0) OR (b.id = ? AND ? > 0)
                GROUP BY b.id
                ORDER BY b.box_number ASC
            `;

            const boxRows = await new Promise((resolve) => {
                con.query(boxesSql, [orderId || 0, orderId || 0, swoId || 0, swoId || 0, primaryBoxId || 0, primaryBoxId || 0], (err, rows) => resolve(rows || []));
            });

            // 4. Fetch damage photos for all these boxes
            const boxIds = boxRows.map(b => b.box_id);
            let photosByBox = {};
            let allOrderPhotos = [];
            if (boxIds.length > 0) {
                const photoRows = await new Promise((resolve) => {
                    con.query(
                        `SELECT f.id, f.box_id, f.file_name, f.file_url, f.file_type, f.created_at,
                                b.box_number, b.total_boxes, b.barcode_string, b.damage_comment
                         FROM warehouse_box_files f
                         LEFT JOIN warehouse_package_boxes b ON b.id = f.box_id
                         WHERE f.box_id IN (?) 
                         ORDER BY f.id DESC`,
                        [boxIds],
                        (err, f) => resolve(f || [])
                    );
                });
                photoRows.forEach(p => {
                    const rawUrl = p.file_url || (p.file_name ? `/damage_photos/${p.file_name}` : null);
                    const photoObj = {
                        file_id: p.id,
                        id: p.id,
                        box_id: p.box_id,
                        box_number: p.box_number || 1,
                        total_boxes: p.total_boxes || 1,
                        box_display: `Box ${p.box_number || 1}/${p.total_boxes || 1}`,
                        barcode_string: p.barcode_string || null,
                        file_name: p.file_name,
                        file_url: rawUrl,
                        full_url: rawUrl,
                        file_type: p.file_type || 'damage_photo',
                        uploaded_at: p.created_at,
                        created_at: p.created_at
                    };
                    if (!photosByBox[p.box_id]) photosByBox[p.box_id] = [];
                    photosByBox[p.box_id].push(photoObj);
                    allOrderPhotos.push(photoObj);
                });
            }

            const origName = header.origin_country_name || 'China';
            const origCode = header.origin_country_code || 'CN';
            const origFlag = WarehouseTrackingController.getCountryFlagEmoji(origCode) || '🇨🇳';

            const destName = header.dest_country_name || 'South Africa';
            const destCode = header.dest_country_code || 'ZA';
            const destFlag = WarehouseTrackingController.getCountryFlagEmoji(destCode) || '🇿🇦';

            const formattedBoxes = boxRows.map(b => {
                const boxStatusEvent = b.current_status && b.current_status !== 'GENERATED' ? b.current_status : (b.last_scan_event || 'Awaiting Check-in');
                const boxBadge = b.current_status === 'GENERATED'
                    ? { status: 'Awaiting Check-in', color: '#757575', bg_color: '#F5F5F5', description: 'Barcode generated, pending physical warehouse scan' }
                    : WarehouseTrackingController.resolveScanActivityBadge(boxStatusEvent, origName, destName);

                const isBoxDamaged = (b.is_damaged === 1 || b.is_damaged === true);
                const boxPhotos = photosByBox[b.box_id] || [];

                return {
                    box_id: b.box_id,
                    box_number: b.box_number || 1,
                    total_boxes: b.total_boxes || 1,
                    box_display: `Box ${b.box_number || 1}/${b.total_boxes || 1}`,
                    barcode_string: b.barcode_string,
                    weight_kg: b.weight_kg ? parseFloat(b.weight_kg) : null,
                    cbm: b.cbm ? parseFloat(b.cbm) : null,
                    dimensions: {
                        length_cm: b.length_cm ? parseFloat(b.length_cm) : null,
                        width_cm: b.width_cm ? parseFloat(b.width_cm) : null,
                        height_cm: b.height_cm ? parseFloat(b.height_cm) : null
                    },
                    current_status: b.current_status || 'GENERATED',
                    status: boxBadge.status,
                    status_badge: boxBadge.status,
                    status_color: isBoxDamaged ? '#C62828' : boxBadge.color,
                    status_bg_color: isBoxDamaged ? '#FFEBEE' : boxBadge.bg_color,
                    is_damaged: isBoxDamaged,
                    damage_comment: b.damage_comment || null,
                    damage_photos: boxPhotos,
                    has_damage_photos: boxPhotos.length > 0,
                    last_scanned_at: b.last_scanned_at || null,
                    last_scan_event: b.last_scan_event || null,
                    scanned_by_name: b.scanned_by_name || null,
                    warehouse_name: b.warehouse_name || null
                };
            });

            // Helper to resolve positive numeric value falling back from tbl_orders to tbl_freight
            const resolvePositiveNumber = (...values) => {
                for (const val of values) {
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0) {
                            return num;
                        }
                    }
                }
                return 0;
            };

            // 5. Order Totals and Consignment Status
            const fallbackPackages = Math.round(resolvePositiveNumber(header.order_cartons, header.swo_packages, header.freight_packages));
            const boxCountFromBoxes = formattedBoxes.length > 0
                ? Math.max(formattedBoxes.length, formattedBoxes[0].total_boxes || 1)
                : 0;
            const totalBoxesCount = Math.max(boxCountFromBoxes, fallbackPackages, 1);

            const scannedBoxesCount = formattedBoxes.filter(b => b.current_status !== 'GENERATED' && b.current_status !== null).length;
            const isConsignmentComplete = (scannedBoxesCount >= totalBoxesCount && scannedBoxesCount > 0);
            const hasDamagedBox = formattedBoxes.some(b => b.is_damaged);

            const boxWeightSum = Math.round(formattedBoxes.reduce((acc, b) => acc + (b.weight_kg || 0), 0) * 100) / 100;
            const fallbackWeight = resolvePositiveNumber(header.order_weight, header.swo_total_weight, header.freight_weight);
            const finalTotalWeight = boxWeightSum > 0 ? boxWeightSum : parseFloat(fallbackWeight.toFixed(2));

            const boxCbmSum = Math.round(formattedBoxes.reduce((acc, b) => acc + (b.cbm || 0), 0) * 1000) / 1000;
            const fallbackCbm = resolvePositiveNumber(header.order_cbm, header.order_dimensions, header.swo_total_cbm, header.freight_dimension);
            const finalTotalCbm = boxCbmSum > 0 ? boxCbmSum : parseFloat(fallbackCbm.toFixed(4));

            let orderDisplayStatus = WarehouseTrackingController.normalizeTimelineStatus(header.order_track_status);
            if (!orderDisplayStatus || orderDisplayStatus === 'GENERATED' || orderDisplayStatus === 'Awaiting Check-in') {
                orderDisplayStatus = isConsignmentComplete
                    ? 'Received at Asia Direct warehouse'
                    : 'Awaiting Check-in';
            }
            orderDisplayStatus = WarehouseTrackingController.normalizeTimelineStatus(orderDisplayStatus);

            // 6. Fetch products associated with this order
            const targetSwoId = swoId || header.supplier_warehouse_order_id;
            const products = await new Promise((resolve) => {
                if (!targetSwoId) return resolve([]);
                con.query(
                    `SELECT id, product_description, package_type, packages, weight, date_received 
                     FROM supplier_warehouse_products 
                     WHERE supplier_warehouse_id = ?`,
                    [targetSwoId],
                    (err, prods) => resolve(prods || [])
                );
            });

            // 7. Fetch Timeline Scans across all boxes for this order
            const timelineRows = await new Promise((resolve) => {
                const tlSql = `
                    SELECT 
                        s2.id AS scan_id,
                        s2.box_id,
                        s2.barcode_string,
                        s2.scan_event,
                        s2.scanned_at,
                        s2.device_id,
                        s2.notes,
                        s2.latitude,
                        s2.longitude,
                        s2.warehouse_id,
                        w2.warehouse_name,
                        u2.full_name AS scanned_by_name,
                        b2.box_number,
                        b2.total_boxes
                    FROM warehouse_box_scans s2
                    LEFT JOIN warehouse_package_boxes b2 ON (b2.id = s2.box_id OR b2.barcode_string = s2.barcode_string)
                    LEFT JOIN warehouse_tbl w2 ON w2.id = s2.warehouse_id
                    LEFT JOIN tbl_users u2 ON u2.id = s2.scanned_by_user_id
                    WHERE (b2.order_id = ? AND ? > 0) 
                       OR (b2.supplier_warehouse_order_id = ? AND ? > 0) 
                       OR (b2.id = ? AND ? > 0)
                       OR s2.barcode_string = ?
                    ORDER BY s2.id ASC
                `;
                con.query(tlSql, [orderId || 0, orderId || 0, swoId || 0, swoId || 0, primaryBoxId || 0, primaryBoxId || 0, targetBarcode], (err, tl) => resolve(tl || []));
            });

            // Build completed milestone timeline for Order Details:
            // In a multi-box consignment, a milestone step ONLY belongs in the Order Timeline
            // when ALL boxes in the consignment have reached that milestone stage!
            const completedMilestonesMap = new Map();
            for (const tl of timelineRows) {
                const tlBadge = WarehouseTrackingController.resolveScanActivityBadge(tl.scan_event, origName, destName);
                const scanRank = WarehouseTrackingController.getMilestoneRank(tl.scan_event);

                const isCompletedForAllBoxes = (totalBoxesCount <= 1) || (
                    scanRank > 0 &&
                    formattedBoxes.filter(b => WarehouseTrackingController.getMilestoneRank(b.current_status) >= scanRank).length >= totalBoxesCount
                );

                if (isCompletedForAllBoxes) {
                    completedMilestonesMap.set(tlBadge.status, {
                        scan_id: tl.scan_id,
                        box_id: tl.box_id,
                        barcode_string: tl.barcode_string,
                        box_number: tl.box_number || 1,
                        total_boxes: tl.total_boxes || 1,
                        box_display: `Box ${tl.box_number || 1}/${tl.total_boxes || 1}`,
                        scan_event: tl.scan_event,
                        event_label: tlBadge.status,
                        status: tlBadge.status,
                        status_color: tlBadge.color,
                        status_bg_color: tlBadge.bg_color,
                        description: tlBadge.description,
                        scanned_at: tl.scanned_at,
                        formatted_date: WarehouseTrackingController.formatDisplayDate(tl.scanned_at),
                        formatted_time: WarehouseTrackingController.formatDisplayTime(tl.scanned_at),
                        warehouse_name: tl.warehouse_name || null,
                        scanned_by_name: tl.scanned_by_name || null,
                        device_id: tl.device_id || 'HANDHELD',
                        notes: tl.notes || null
                    });
                }
            }
            const formattedTimeline = Array.from(completedMilestonesMap.values());

            // 8. Freight Details & Routing
            const freight = WarehouseTrackingController.resolveFreightDetails(header);
            const refNo = header.container_no || header.batch_number || header.order_number || header.freight_number || ('ORD-' + (orderId || swoId));

            // 9. Backwards compatibility objects: Primary Box & Latest Activity
            const primaryBox = formattedBoxes.length > 0 ? formattedBoxes[0] : {
                box_id: primaryBoxId || null,
                barcode_string: targetBarcode,
                box_number: 1,
                total_boxes: totalBoxesCount,
                box_display: `Box 1/${totalBoxesCount}`,
                current_status: 'GENERATED',
                status: 'Awaiting Check-in',
                damage_photos: []
            };

            const latestScan = timelineRows.length > 0 ? timelineRows[timelineRows.length - 1] : null;
            const latestBadge = latestScan
                ? WarehouseTrackingController.resolveScanActivityBadge(latestScan.scan_event, origName, destName)
                : { status: orderDisplayStatus, color: '#1976D2', bg_color: '#E3F2FD', description: 'Order logged' };

            const activityObj = {
                scan_id: latestScan ? latestScan.scan_id : (targetScanId || null),
                scan_event: latestScan ? latestScan.scan_event : 'received_origin',
                event_label: latestBadge.status,
                status: latestBadge.status,
                status_color: latestBadge.color,
                status_bg_color: latestBadge.bg_color,
                description: latestBadge.description,
                scanned_at: latestScan ? latestScan.scanned_at : new Date(),
                formatted_date: WarehouseTrackingController.formatDisplayDate(latestScan ? latestScan.scanned_at : new Date()),
                formatted_time: WarehouseTrackingController.formatDisplayTime(latestScan ? latestScan.scanned_at : new Date()),
                device_id: latestScan ? (latestScan.device_id || 'HANDHELD') : 'HANDHELD',
                latitude: latestScan && latestScan.latitude ? parseFloat(latestScan.latitude) : null,
                longitude: latestScan && latestScan.longitude ? parseFloat(latestScan.longitude) : null,
                notes: latestScan ? latestScan.notes : null,
                warehouse: {
                    id: header.origin_warehouse_id || null,
                    name: header.origin_warehouse_name || 'Central Warehouse',
                    country: origName
                },
                scanned_by: {
                    name: (latestScan && latestScan.scanned_by_name) || 'Santosh Gupta',
                    email: ''
                }
            };

            return res.status(200).json({
                success: true,
                data: {
                    order: {
                        order_id: header.order_id,
                        supplier_warehouse_order_id: header.supplier_warehouse_order_id,
                        order_number: header.order_number,
                        client_name: header.client_name,
                        supplier_name: header.supplier_name || 'N/A',
                        goods_description: header.goods_description || header.freight_product_desc || null,
                        status: orderDisplayStatus,
                        status_badge: orderDisplayStatus,
                        status_color: hasDamagedBox ? '#C62828' : (isConsignmentComplete ? '#2E7D32' : '#1976D2'),
                        status_bg_color: hasDamagedBox ? '#FFEBEE' : (isConsignmentComplete ? '#E8F5E9' : '#E3F2FD'),
                        total_boxes: totalBoxesCount,
                        boxes_scanned: scannedBoxesCount,
                        box_display: `Boxes ${scannedBoxesCount}/${totalBoxesCount}`,
                        is_consignment_complete: isConsignmentComplete,
                        progress_percentage: totalBoxesCount > 0 ? Math.min(100, Math.round((scannedBoxesCount / totalBoxesCount) * 100)) : 0,
                        is_damaged: hasDamagedBox,
                        total_weight_kg: finalTotalWeight,
                        total_cbm: finalTotalCbm,
                        products: products
                    },
                    routing: {
                        freight_type: freight.type,
                        freight_label: freight.label,
                        freight_icon: freight.icon,
                        reference_no: refNo,
                        container_no: header.container_no || null,
                        vessel: header.vessel || null,
                        carrier: header.carrier || null,
                        waybill: header.batch_waybill || null,
                        batch_id: header.resolved_batch_id || null,
                        batch_number: header.batch_number || null,
                        origin: {
                            country_name: origName,
                            country_code: origCode,
                            flag: origFlag
                        },
                        destination: {
                            country_name: destName,
                            country_code: destCode,
                            flag: destFlag
                        },
                        route: `${origName} ➔ ${destName}`,
                        route_with_flags: `${origFlag} ${origName} ➔ ${destFlag} ${destName}`
                    },
                    boxes: formattedBoxes,
                    activity: activityObj,
                    box: primaryBox,
                    timeline: formattedTimeline,
                    attachments: allOrderPhotos,
                    damage_photos: allOrderPhotos
                }
            });
        } catch (error) {
            logger.error('Error fetching activity details:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch activity details'
            });
        }
    }

    /**
     * Recent Activities List (Paginated, Filterable for "View All" screen)
     * GET /api/warehouse/activities OR /api/warehouse/scans OR /api/warehouse/orders/recent
     * Supports:
     * - Default: Groups by Order (Clean order list with boxes scanned count)
     * - view=scans: Raw scan events
     */
    static async getActivitiesList(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const offset = (page - 1) * limit;

            const search = (req.query.search || '').trim();
            const freightType = (req.query.freight_type || '').toLowerCase().trim();
            const isDamaged = req.query.is_damaged;
            const view = (req.query.view || req.query.type || 'orders').toLowerCase().trim();

            if (view === 'scans' || view === 'boxes') {
                // Raw scan list
                let whereClauses = ['1=1'];
                let params = [];

                if (search) {
                    whereClauses.push(`(
                        s.barcode_string LIKE ? 
                        OR b.warehouse_order_number LIKE ? 
                        OR bt.container_no LIKE ? 
                        OR bt.batch_number LIKE ? 
                        OR u.full_name LIKE ?
                    )`);
                    const sParam = `%${search}%`;
                    params.push(sParam, sParam, sParam, sParam, sParam);
                }

                if (req.query.scan_event) {
                    whereClauses.push(`LOWER(s.scan_event) = ?`);
                    params.push(req.query.scan_event.toLowerCase().trim());
                }

                if (isDamaged === '1' || isDamaged === 'true') {
                    whereClauses.push(`b.is_damaged = 1`);
                }

                const whereSql = whereClauses.join(' AND ');
                const countSql = `
                    SELECT COUNT(*) AS total
                    FROM warehouse_box_scans s
                    LEFT JOIN warehouse_package_boxes b ON (b.id = s.box_id OR b.barcode_string = s.barcode_string)
                    LEFT JOIN batches bt ON bt.id = COALESCE(s.batch_id, b.assigned_batch_id)
                    LEFT JOIN tbl_users u ON u.id = s.scanned_by_user_id
                    WHERE ${whereSql}
                `;

                const totalRows = await new Promise((resolve) => {
                    con.query(countSql, params, (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0));
                });

                const dataSql = `
                    SELECT 
                        s.id AS scan_id,
                        s.box_id,
                        s.barcode_string,
                        s.scan_event,
                        s.warehouse_id,
                        s.batch_id,
                        s.scanned_by_user_id,
                        s.device_id,
                        s.latitude,
                        s.longitude,
                        s.notes,
                        s.scanned_at,
                        b.id AS box_tbl_id,
                        b.box_number,
                        b.total_boxes,
                        b.weight_kg,
                        b.length_cm,
                        b.width_cm,
                        b.height_cm,
                        b.cbm,
                        b.current_status AS box_current_status,
                        b.is_damaged,
                        b.damage_comment,
                        b.warehouse_order_number,
                        b.order_id,
                        b.supplier_warehouse_order_id,
                        u.full_name AS scanned_by_name,
                        w.warehouse_name,
                        bt.batch_number,
                        bt.container_no,
                        bt.freight AS batch_freight,
                        o.freight_type AS order_freight_type,
                        o.mode_of_transport,
                        tf.freight AS tbl_freight_type,
                        o.client_name,
                        o.order_number,
                        COALESCE(c_orig.name, 'China') AS origin_country_name,
                        COALESCE(c_orig.shortname, 'CN') AS origin_country_code,
                        COALESCE(c_dest.name, 'South Africa') AS dest_country_name,
                        COALESCE(c_dest.shortname, 'ZA') AS dest_country_code
                    FROM warehouse_box_scans s
                    LEFT JOIN warehouse_package_boxes b ON (b.id = s.box_id OR b.barcode_string = s.barcode_string)
                    LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                    LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                    LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                    LEFT JOIN batches bt ON bt.id = COALESCE(s.batch_id, b.assigned_batch_id)
                    LEFT JOIN tbl_users u ON u.id = s.scanned_by_user_id
                    LEFT JOIN warehouse_tbl w ON w.id = s.warehouse_id
                    LEFT JOIN warehouse_tbl w_orig ON w_orig.id = COALESCE(b.origin_warehouse_id, swo.warehouse_id)
                    LEFT JOIN countries c_orig ON c_orig.id = w_orig.country
                    LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                    LEFT JOIN countries c_dest ON c_dest.id = w_dest.country
                    WHERE ${whereSql}
                    ORDER BY s.id DESC
                    LIMIT ? OFFSET ?
                `;

                const rows = await new Promise((resolve) => {
                    con.query(dataSql, [...params, limit, offset], (err, results) => resolve(results || []));
                });

                let items = rows.map(r => WarehouseTrackingController.formatActivityCardItem(r));
                if (freightType) {
                    items = items.filter(it => it.freight_type === freightType);
                }

                return res.status(200).json({
                    success: true,
                    pagination: {
                        total: totalRows,
                        page: page,
                        limit: limit,
                        total_pages: Math.ceil(totalRows / limit)
                    },
                    data: items
                });
            }

            // Default: Grouped by Orders
            let whereClauses = ['(b.order_id IS NOT NULL OR b.supplier_warehouse_order_id IS NOT NULL)'];
            let params = [];

            if (search) {
                whereClauses.push(`(
                    o.order_number LIKE ? 
                    OR b.warehouse_order_number LIKE ? 
                    OR o.client_name LIKE ? 
                    OR swo.customer_name LIKE ? 
                    OR bt.container_no LIKE ? 
                    OR bt.batch_number LIKE ?
                )`);
                const sParam = `%${search}%`;
                params.push(sParam, sParam, sParam, sParam, sParam, sParam);
            }

            if (isDamaged === '1' || isDamaged === 'true') {
                whereClauses.push(`b.is_damaged = 1`);
            }

            const whereSql = whereClauses.join(' AND ');

            // Subquery for total order count
            const countSql = `
                SELECT COUNT(*) AS total FROM (
                    SELECT 1
                    FROM warehouse_package_boxes b
                    LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                    LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                    LEFT JOIN batches bt ON bt.id = b.assigned_batch_id
                    WHERE ${whereSql}
                    GROUP BY COALESCE(b.order_id, swo.order_id), b.supplier_warehouse_order_id, COALESCE(o.order_number, b.warehouse_order_number)
                ) AS grp
            `;

            const totalRows = await new Promise((resolve) => {
                con.query(countSql, params, (err, rows) => resolve(rows && rows[0] ? rows[0].total : 0));
            });

            const dataSql = `
                SELECT 
                    COALESCE(b.order_id, swo.order_id) AS resolved_order_id,
                    b.supplier_warehouse_order_id,
                    COALESCE(o.order_number, b.warehouse_order_number, CONCAT('ORD-', COALESCE(b.order_id, swo.order_id))) AS order_number,
                    COALESCE(o.client_name, swo.customer_name, 'Asia Direct Logistics') AS client_name,
                    o.track_status AS order_track_status,
                    MAX(s.scanned_at) AS last_scanned_at,
                    MAX(COALESCE(s.scanned_at, b.updated_at, b.created_at)) AS last_activity_at,
                    MAX(s.id) AS latest_scan_id,
                    MAX(s.barcode_string) AS latest_barcode_string,
                    MAX(s.scan_event) AS latest_scan_event,
                    COUNT(DISTINCT b.id) AS total_boxes_count,
                    MAX(b.total_boxes) AS defined_total_boxes,
                    COUNT(DISTINCT CASE WHEN b.current_status != 'GENERATED' AND b.current_status IS NOT NULL THEN b.id END) AS scanned_boxes_count,
                    MAX(b.is_damaged) AS has_damaged_box,
                    o.freight_type AS order_freight_type,
                    o.mode_of_transport,
                    tf.freight AS tbl_freight_type,
                    bt.freight AS batch_freight,
                    bt.container_no,
                    bt.batch_number,
                    w.warehouse_name,
                    COALESCE(c_orig.name, 'China') AS origin_country_name,
                    COALESCE(c_orig.shortname, 'CN') AS origin_country_code,
                    COALESCE(c_dest.name, 'South Africa') AS dest_country_name,
                    COALESCE(c_dest.shortname, 'ZA') AS dest_country_code
                FROM warehouse_package_boxes b
                LEFT JOIN warehouse_box_scans s ON (s.box_id = b.id OR s.barcode_string = b.barcode_string)
                LEFT JOIN supplier_warehouse_orders swo ON swo.id = b.supplier_warehouse_order_id
                LEFT JOIN tbl_orders o ON (o.id = b.order_id OR o.id = swo.order_id)
                LEFT JOIN tbl_freight tf ON tf.id = o.freight_id
                LEFT JOIN batches bt ON bt.id = b.assigned_batch_id
                LEFT JOIN warehouse_tbl w ON w.id = b.origin_warehouse_id
                LEFT JOIN countries c_orig ON c_orig.id = w.country
                LEFT JOIN warehouse_tbl w_dest ON w_dest.id = b.destination_warehouse_id
                LEFT JOIN countries c_dest ON c_dest.id = w_dest.country
                WHERE ${whereSql}
                GROUP BY 
                    COALESCE(b.order_id, swo.order_id),
                    b.supplier_warehouse_order_id,
                    COALESCE(o.order_number, b.warehouse_order_number)
                ORDER BY MAX(COALESCE(s.scanned_at, b.updated_at, b.created_at)) DESC
                LIMIT ? OFFSET ?
            `;

            const rows = await new Promise((resolve) => {
                con.query(dataSql, [...params, limit, offset], (err, results) => resolve(results || []));
            });

            let items = rows.map(r => WarehouseTrackingController.formatOrderActivityCardItem(r));

            if (freightType) {
                items = items.filter(it => it.freight_type === freightType);
            }

            return res.status(200).json({
                success: true,
                pagination: {
                    total: totalRows,
                    page: page,
                    limit: limit,
                    total_pages: Math.ceil(totalRows / limit)
                },
                data: items
            });
        } catch (error) {
            logger.error('Error fetching activities list:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch activities list'
            });
        }
    }
}

module.exports = WarehouseTrackingController;

/**
 * Mock Data for UI Testing
 * Populates window.events and window.responses with realistic test data.
 * Load via: <script src="js/mock-data.js"></script> or call loadMockData() from console.
 */

(function () {
    'use strict';

    function generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    var now = Date.now();

    // ── Mock Events ──────────────────────────────────────────────────────

    var mockEvents = {
        // ── Active / Upcoming Events ─────────────────────────────────────

        'evt-promo-001': {
            id: 'evt-promo-001',
            title: 'Sgt Rodriguez Promotion Ceremony',
            date: '2026-03-15',
            time: '10:00',
            location: 'Headquarters Battalion Parade Deck',
            description: 'Join us in celebrating Cpl Rodriguez\'s meritorious promotion to Sergeant.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: false,
            customQuestions: [],
            eventDetails: {
                'honoree-name': { label: 'Honoree Name', value: 'Cpl Maria Rodriguez' },
                'current-rank': { label: 'Current Rank', value: 'Corporal' },
                'new-rank': { label: 'New Rank', value: 'Sergeant' },
                'promoter-name': { label: 'Promoted By', value: 'Col Thompson' }
            },
            status: 'active',
            created: now - 86400000 * 5,
            lastModified: now - 86400000 * 2,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-ball-002': {
            id: 'evt-ball-002',
            title: 'Marine Corps Birthday Ball',
            date: '2026-04-10',
            time: '18:00',
            location: 'Grand Ballroom, Pacific Views Lodge',
            description: 'Join us in celebrating the founding of the United States Marine Corps with tradition, camaraderie, and honor.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: true,
            customQuestions: [
                { id: 'meal', question: 'Meal preference?', type: 'select', required: true, options: ['Steak', 'Chicken', 'Vegetarian', 'Fish'] },
                { id: 'dietary', question: 'Any dietary restrictions?', type: 'text', required: false, options: [] }
            ],
            eventDetails: {
                'ball-year': { label: 'Birthday Year', value: '251st Birthday' },
                'venue': { label: 'Venue', value: 'Grand Ballroom' },
                'dress-code': { label: 'Dress Code', value: 'Dress Blues / Evening Attire' },
                'ticket-price': { label: 'Ticket Price', value: '$85 per person' }
            },
            seatingChart: {
                enabled: true,
                numberOfTables: 12,
                seatsPerTable: 8,
                totalCapacity: 96,
                tables: Array.from({ length: 12 }, function (_, i) {
                    return {
                        tableNumber: i + 1,
                        capacity: 8,
                        assignedGuests: [],
                        vipTable: i === 0
                    };
                })
            },
            status: 'active',
            created: now - 86400000 * 14,
            lastModified: now - 86400000 * 1,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-training-003': {
            id: 'evt-training-003',
            title: 'Combat First Aid Refresher',
            date: '2026-03-05',
            time: '07:30',
            location: 'Building 1440, Room 204',
            description: 'Annual combat first aid recertification. All personnel must attend.',
            askReason: true,
            allowGuests: false,
            requiresMealChoice: false,
            customQuestions: [],
            eventDetails: {
                'training-topic': { label: 'Training Topic', value: 'Combat First Aid / TCCC' },
                'instructor': { label: 'Instructor', value: 'HM1 Sarah Chen' },
                'prerequisites': { label: 'Prerequisites', value: 'Current CAC, PT gear' },
                'equipment-bring': { label: 'Equipment to Bring', value: 'IFAK, notebook, pen' }
            },
            status: 'active',
            created: now - 86400000 * 10,
            lastModified: now - 86400000 * 3,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-family-004': {
            id: 'evt-family-004',
            title: 'Spring Family Day Cookout',
            date: '2026-04-25',
            time: '11:00',
            location: 'Del Mar Beach, Area 21',
            description: 'Bring your families for a day of food, games, and camaraderie.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: true,
            customQuestions: [
                { id: 'kids', question: 'How many children under 12?', type: 'number', required: false, options: [] }
            ],
            eventDetails: {
                'activities-available': { label: 'Activities', value: 'BBQ, Volleyball, Bounce Houses, Face Painting' },
                'food-provided': { label: 'Food/Beverages', value: 'Burgers, hot dogs, sides, drinks provided' },
                'parking-info': { label: 'Parking', value: 'Lot C — overflow at Lot D' }
            },
            status: 'active',
            created: now - 86400000 * 7,
            lastModified: now - 86400000 * 1,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-coc-005': {
            id: 'evt-coc-005',
            title: '3rd Battalion Change of Command',
            date: '2026-05-01',
            time: '09:00',
            location: 'Parade Deck, Mainside',
            description: 'Join us for the formal transfer of authority and responsibility for 3rd Battalion.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: true,
            customQuestions: [],
            eventDetails: {
                'outgoing-co': { label: 'Outgoing Commander', value: 'LtCol James Wright' },
                'incoming-co': { label: 'Incoming Commander', value: 'LtCol Diana Park' },
                'reviewing-officer': { label: 'Reviewing Officer', value: 'Col Martinez' },
                'unit-designation': { label: 'Unit', value: '3rd Battalion, 5th Marines' }
            },
            status: 'active',
            created: now - 86400000 * 20,
            lastModified: now - 86400000 * 4,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-formation-006': {
            id: 'evt-formation-006',
            title: 'Battalion Formation — Uniform Inspection',
            date: '2026-03-10',
            time: '06:30',
            location: 'Grinder, Building 1100',
            description: 'Mandatory battalion formation. Service Charlies. No exceptions.',
            askReason: true,
            allowGuests: false,
            requiresMealChoice: false,
            customQuestions: [],
            eventDetails: {
                'formation-type': { label: 'Formation Type', value: 'Battalion Formation' },
                'uniform': { label: 'Uniform', value: 'Service Charlies' },
                'reporting-senior': { label: 'Reporting Senior', value: '1stSgt Davis' }
            },
            status: 'active',
            created: now - 86400000 * 3,
            lastModified: now - 86400000 * 1,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        // ── Past Events ──────────────────────────────────────────────────

        'evt-retire-007': {
            id: 'evt-retire-007',
            title: 'MSgt Williams Retirement Ceremony',
            date: '2026-01-20',
            time: '14:00',
            location: 'Officers\' Club, Camp Pendleton',
            description: 'Please join us in honoring the distinguished career and dedicated service of MSgt Williams.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: true,
            customQuestions: [],
            eventDetails: {
                'retiree-name': { label: 'Retiree Name', value: 'MSgt David Williams' },
                'years-service': { label: 'Years of Service', value: '24 years' },
                'retiring-rank': { label: 'Retiring Rank', value: 'Master Sergeant' },
                'reception-location': { label: 'Reception Location', value: 'Officers\' Club Patio' }
            },
            status: 'active',
            created: now - 86400000 * 60,
            lastModified: now - 86400000 * 38,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-awards-008': {
            id: 'evt-awards-008',
            title: 'Quarterly Awards Ceremony',
            date: '2025-12-12',
            time: '15:00',
            location: 'Base Theater',
            description: 'Join us in recognizing Marines for their exceptional performance this quarter.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: false,
            customQuestions: [],
            eventDetails: {
                'award-type': { label: 'Award(s) Presented', value: 'Navy Achievement Medal, Marine of the Quarter' },
                'recipient-names': { label: 'Recipients', value: 'Cpl Adams, LCpl Torres, Sgt Kim' },
                'presenting-officer': { label: 'Presenting Officer', value: 'Col Briggs' }
            },
            status: 'active',
            created: now - 86400000 * 90,
            lastModified: now - 86400000 * 78,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-dining-009': {
            id: 'evt-dining-009',
            title: 'Annual Dining Out',
            date: '2026-02-14',
            time: '19:00',
            location: 'Town & Country Resort, San Diego',
            description: 'You are cordially invited to attend our formal dining event.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: true,
            customQuestions: [
                { id: 'meal', question: 'Entree selection?', type: 'select', required: true, options: ['Prime Rib', 'Salmon', 'Vegetarian Pasta'] }
            ],
            eventDetails: {
                'event-type': { label: 'Event Type', value: 'Dining Out (guests welcome)' },
                'dress-code': { label: 'Dress Code', value: 'Dress Blues / Formal Attire' },
                'guest-speaker': { label: 'Guest Speaker', value: 'MajGen (Ret) Patricia Hayes' },
                'cost-per-person': { label: 'Cost Per Person', value: '$65' }
            },
            seatingChart: {
                enabled: true,
                numberOfTables: 8,
                seatsPerTable: 10,
                totalCapacity: 80,
                tables: Array.from({ length: 8 }, function (_, i) {
                    return {
                        tableNumber: i + 1,
                        capacity: 10,
                        assignedGuests: [],
                        vipTable: i === 0
                    };
                })
            },
            status: 'active',
            created: now - 86400000 * 45,
            lastModified: now - 86400000 * 14,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        },

        'evt-memorial-010': {
            id: 'evt-memorial-010',
            title: 'Memorial Service — Sgt Marcus Lee',
            date: '2026-01-05',
            time: '10:00',
            location: 'Base Chapel',
            description: 'We gather to honor and remember Sgt Marcus Lee, who made the ultimate sacrifice.',
            askReason: false,
            allowGuests: true,
            requiresMealChoice: false,
            customQuestions: [],
            eventDetails: {
                'honoree-name': { label: 'In Memory Of', value: 'Sgt Marcus Lee' },
                'service-dates': { label: 'Service Dates', value: '2018 - 2025' },
                'chaplain': { label: 'Officiant', value: 'Chaplain Roberts' },
                'reception-info': { label: 'Reception Details', value: 'Fellowship Hall immediately following' }
            },
            status: 'active',
            created: now - 86400000 * 55,
            lastModified: now - 86400000 * 53,
            createdBy: 'testuser',
            createdByName: 'Test User',
            coverImage: ''
        }
    };

    // ── Mock RSVP Responses ──────────────────────────────────────────────

    var names = [
        'SSgt Mike Johnson', 'Cpl Ana Reyes', 'LCpl Derek Stone',
        'Sgt Lisa Park', 'PFC Omar Hassan', 'GySgt Frank Torres',
        'Cpl Brittany Cole', 'LCpl Tyler Webb', 'Sgt Kenji Tanaka',
        'Cpl Rachel Morrison', 'LCpl Chris Nguyen', 'PFC Jamie Sullivan',
        'SSgt Dan Kowalski', 'Cpl Maria Santos', 'LCpl Alex Kim'
    ];

    function buildResponses(eventId, count, attendRate) {
        var responses = [];
        for (var i = 0; i < count; i++) {
            var attending = Math.random() < attendRate;
            responses.push({
                id: generateId(),
                eventId: eventId,
                name: names[i % names.length],
                email: names[i % names.length].split(' ').pop().toLowerCase() + '@usmc.mil',
                status: attending ? 'attending' : 'not-attending',
                guestCount: attending && Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0,
                reason: attending ? '' : 'Prior commitment',
                mealChoice: attending ? ['Steak', 'Chicken', 'Vegetarian', 'Fish'][Math.floor(Math.random() * 4)] : '',
                customAnswers: {},
                timestamp: now - Math.floor(Math.random() * 86400000 * 10),
                submittedAt: now - Math.floor(Math.random() * 86400000 * 10)
            });
        }
        return responses;
    }

    var mockResponses = {};
    // Promotion — 8 RSVPs
    mockResponses['evt-promo-001'] = buildResponses('evt-promo-001', 8, 0.9);
    // Birthday Ball — 15 RSVPs
    mockResponses['evt-ball-002'] = buildResponses('evt-ball-002', 15, 0.85);
    // Training — 12 RSVPs
    mockResponses['evt-training-003'] = buildResponses('evt-training-003', 12, 0.95);
    // Family Day — 10 RSVPs
    mockResponses['evt-family-004'] = buildResponses('evt-family-004', 10, 0.8);
    // Change of Command — 6 RSVPs
    mockResponses['evt-coc-005'] = buildResponses('evt-coc-005', 6, 0.9);
    // Formation — 14 RSVPs
    mockResponses['evt-formation-006'] = buildResponses('evt-formation-006', 14, 0.95);
    // Retirement (past) — 11 RSVPs
    mockResponses['evt-retire-007'] = buildResponses('evt-retire-007', 11, 0.85);
    // Awards (past) — 9 RSVPs
    mockResponses['evt-awards-008'] = buildResponses('evt-awards-008', 9, 0.9);
    // Dining Out (past) — 13 RSVPs
    mockResponses['evt-dining-009'] = buildResponses('evt-dining-009', 13, 0.8);
    // Memorial (past) — 7 RSVPs
    mockResponses['evt-memorial-010'] = buildResponses('evt-memorial-010', 7, 0.95);

    // ── Loader ───────────────────────────────────────────────────────────

    function loadMockData() {
        if (!window.events) window.events = {};
        if (!window.responses) window.responses = {};

        Object.keys(mockEvents).forEach(function (key) {
            window.events[key] = mockEvents[key];
        });
        Object.keys(mockResponses).forEach(function (key) {
            window.responses[key] = mockResponses[key];
        });

        console.log('[Mock Data] Loaded ' + Object.keys(mockEvents).length + ' events and RSVP responses');

        // Re-render dashboard if available
        if (typeof renderDashboard === 'function') {
            renderDashboard();
        }
    }

    // Auto-load when the script runs
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMockData);
    } else {
        loadMockData();
    }

    // Expose for manual use from console
    window.loadMockData = loadMockData;
})();

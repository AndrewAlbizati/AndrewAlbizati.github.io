let records = [];
let currentSort = 'recent';
const recordCountEl = document.querySelector('[data-record-count]');
const averageRatingEl = document.querySelector('[data-average-rating]');
const medianYearEl = document.querySelector('[data-median-year]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const albumFallback =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
          <rect width="600" height="600" fill="#111617"/>
          <rect x="48" y="48" width="504" height="504" rx="28" fill="#182426" stroke="#315259" stroke-width="8"/>
          <circle cx="300" cy="300" r="134" fill="#0b0f10" stroke="#86efac" stroke-width="10"/>
          <circle cx="300" cy="300" r="20" fill="#86efac"/>
          <text x="300" y="520" text-anchor="middle" fill="#a1b5a6" font-family="IBM Plex Mono, monospace" font-size="34">No Album Art</text>
        </svg>
    `);

document.addEventListener('DOMContentLoaded', function () {
    const body = document.body;
    const nav = document.querySelector('[data-nav]');
    const navToggle = document.querySelector('[data-nav-toggle]');
    const sortSelect = document.getElementById('sort-select');
    const yearNode = document.querySelector('[data-year]');

    if (yearNode) {
        yearNode.textContent = String(new Date().getFullYear());
    }

    if (nav && navToggle) {
        navToggle.addEventListener('click', function () {
            const isOpen = !body.classList.contains('nav-open');
            body.classList.toggle('nav-open', isOpen);
            navToggle.setAttribute('aria-expanded', String(isOpen));
        });

        document.addEventListener('click', function (event) {
            if (!body.classList.contains('nav-open')) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }

            if (nav.contains(target) || navToggle.contains(target)) {
                return;
            }

            body.classList.remove('nav-open');
            navToggle.setAttribute('aria-expanded', 'false');
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                body.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    sortSelect.addEventListener('change', function () {
        currentSort = this.value;
        sortRecords();
        renderRecords();
    });

    setupRevealAnimation();
    loadRecords();
});

function loadRecords() {
    const messageEl = document.getElementById('records-message');
    const gridEl = document.getElementById('records-grid');

    messageEl.hidden = true;
    gridEl.innerHTML = '';

    fetch('records.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(csvText => {
            const parsed = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true
            });

            records = parsed.data.map(row => {
                const title = (row.title || '').trim();
                const artist = (row.artist || '').trim();
                const year = row.release_year ? parseInt(row.release_year, 10) : null;
                const imageUrl = (row.album_art_image_url || '').trim();
                const rating = row.review ? parseFloat(row.review) : null;
                const description = (row.description || '').trim();
                const timestampRaw = (row.timestamp || '').trim();
                const timestamp = timestampRaw ? new Date(timestampRaw) : null;

                return {
                    title,
                    artist,
                    year,
                    imageUrl,
                    rating,
                    description,
                    timestamp,
                    timestampRaw
                };
            });

            if (!records.length) {
                messageEl.textContent = 'No records found in records.csv yet.';
                messageEl.hidden = false;
                updateSummary();
                return;
            }

            sortRecords();
            updateSummary();
            renderRecords();
        })
        .catch(error => {
            console.error('Error loading records.csv:', error);
            messageEl.textContent = 'Error loading record data. Make sure records.csv is in this folder and accessible.';
            messageEl.hidden = false;
        });
}

/* Sorting helpers */

function sortRecords() {
    if (!records || !records.length) return;

    switch (currentSort) {
        case 'alpha':
            records.sort(compareByArtistThenDate);
            break;
        case 'year':
            records.sort(compareByYear);
            break;
        case 'rating':
            records.sort(compareByRating);
            break;
        case 'recent':
        default:
            records.sort(compareByRecent);
            break;
    }
}

// Recently added: newest timestamp first
function compareByRecent(a, b) {
    const tA = a.timestamp ? a.timestamp.getTime() : 0;
    const tB = b.timestamp ? b.timestamp.getTime() : 0;
    //return tB - tA;
    return tB - tA;
}

function normalizeArtist(name) {
    if (!name) return "";

    let cleaned = name.trim().toLowerCase();

    // Ignore “the ” if it's at the beginning
    if (cleaned.startsWith("the ")) {
        cleaned = cleaned.slice(4);
    }

    return cleaned;
}

// Alphabetical by artist last name, then by timestamp (earliest first)
function compareByArtistThenDate(a, b) {
    const artistA = normalizeArtist(a.artist);
    const artistB = normalizeArtist(b.artist);

    if (artistA < artistB) return -1;
    if (artistA > artistB) return 1;

    // Same artist -> sort by release year, earliest first
    const yA = (typeof a.year === 'number') ? a.year : Number.POSITIVE_INFINITY;
    const yB = (typeof b.year === 'number') ? b.year : Number.POSITIVE_INFINITY;

    if (yA !== yB) {
        return yA - yB; // earlier year first (e.g., 1977 before 1978)
    }

    // Same artist & same year (or missing years) -> sort by timestamp, earliest added first
    const tA = a.timestamp ? a.timestamp.getTime() : Number.POSITIVE_INFINITY;
    const tB = b.timestamp ? b.timestamp.getTime() : Number.POSITIVE_INFINITY;

    return tA - tB;
}

// Release year: newest first, then artist last name
function compareByYear(a, b) {
    const yA = a.year || 0;
    const yB = b.year || 0;

    if (yA !== yB) {
        return yB - yA; // newest first
    }

    return compareByArtistThenDate(a, b);
}

// Rating: highest first, then recently added
function compareByRating(a, b) {
    const rA = (typeof a.rating === 'number') ? a.rating : -Infinity;
    const rB = (typeof b.rating === 'number') ? b.rating : -Infinity;

    if (rA !== rB) {
        return rB - rA;
    }

    return compareByRecent(a, b);
}

/* Rendering */

function renderRecords() {
    const gridEl = document.getElementById('records-grid');
    const messageEl = document.getElementById('records-message');

    gridEl.innerHTML = '';
    messageEl.hidden = true;

    if (!records || !records.length) {
        messageEl.textContent = 'No records to display.';
        messageEl.hidden = false;
        return;
    }

    let html = '';
    records.forEach(record => {
        const title = escapeHtml(record.title || 'Untitled');
        const artist = escapeHtml(record.artist || 'Unknown Artist');
        const year = record.year ? record.year : '—';
        const imgUrl = record.imageUrl || albumFallback;


        let ratingText;
        if (typeof record.rating === 'number') {
            if (Number.isInteger(record.rating)) {
                ratingText = record.rating.toString();
            } else {
                ratingText = record.rating.toFixed(1);
            }
            ratingText += "/5";
        } else {
            ratingText = "Not rated";
        }

        const ratingStars = ratingToStars(record.rating);
        const description = escapeHtml(record.description || '');
        const timestampLabel = formatTimestamp(record.timestamp);

        if (description.length == 0) {
            return;
        }

        html += `
        <article class="record-card reveal">
            <img src="${imgUrl}" alt="${title} album art" loading="lazy" onerror="this.onerror=null;this.src='${albumFallback}'">
            <div class="record-card-body">
              <div class="record-title">${title}</div>
              <div class="record-artist">${artist}</div>
              <div class="record-meta">Released: ${year}</div>
              <div class="record-rating">
                  <span class="record-rating-stars">${ratingStars}</span>
                  <span>${ratingText}</span>
              </div>
              <div class="record-description">${description}</div>
              <div class="record-timestamp">Added: ${timestampLabel}</div>
            </div>
        </article>
    `;
    });

    gridEl.innerHTML = html;
    observeRevealNodes(gridEl.querySelectorAll('.reveal'));
}

function updateSummary() {
    if (recordCountEl) {
        recordCountEl.textContent = String(records.length);
    }

    if (averageRatingEl) {
        averageRatingEl.textContent = formatAverageRating(records);
    }

    if (medianYearEl) {
        medianYearEl.textContent = formatMedianYear(records);
    }
}

let revealObserver = null;

function setupRevealAnimation() {
    if (reducedMotion || !('IntersectionObserver' in window)) {
        observeRevealNodes(document.querySelectorAll('.reveal'));
        return;
    }

    revealObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.12,
            rootMargin: '0px 0px -10% 0px'
        }
    );

    observeRevealNodes(document.querySelectorAll('.reveal'));
}

function observeRevealNodes(nodes) {
    Array.from(nodes).forEach(node => {
        if (reducedMotion || !revealObserver) {
            node.classList.add('is-visible');
            return;
        }

        if (!node.classList.contains('is-visible')) {
            revealObserver.observe(node);
        }
    });
}

function formatAverageRating(recordList) {
    const ratings = recordList
        .map(record => record.rating)
        .filter(rating => typeof rating === 'number' && !isNaN(rating));

    if (!ratings.length) return '—';

    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return `${average.toFixed(1)}/5`;
}

function formatMedianYear(recordList) {
    const years = recordList
        .map(record => record.year)
        .filter(year => typeof year === 'number' && !isNaN(year))
        .sort((left, right) => left - right);

    if (!years.length) return '—';

    const middle = Math.floor(years.length / 2);

    if (years.length % 2 === 1) {
        return String(years[middle]);
    }

    const median = (years[middle - 1] + years[middle]) / 2;
    return Number.isInteger(median) ? String(median) : median.toFixed(1);
}

function ratingToStars(rating) {
    const maxStars = 5;

    if (typeof rating !== 'number' || isNaN(rating)) {
        return '<span class="star"></span>'.repeat(maxStars);
    }

    // Clamp rating to [0, 5]
    const clamped = Math.max(0, Math.min(rating, maxStars));
    const fullStars = Math.floor(clamped);
    const fraction = clamped - fullStars;

    // Decide whether we render a half star
    const hasHalf = fraction >= 0.25 && fraction < 0.75;
    const totalFilled = fullStars + (hasHalf ? 1 : 0);
    const emptyStars = maxStars - totalFilled;

    let html = '';

    // Full stars
    for (let i = 0; i < fullStars; i++) {
        html += '<span class="star full"></span>';
    }

    // Half star (if needed)
    if (hasHalf) {
        html += '<span class="star half"></span>';
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        html += '<span class="star"></span>';
    }

    return html;
}

function formatTimestamp(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'Unknown';
    return dateObj.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

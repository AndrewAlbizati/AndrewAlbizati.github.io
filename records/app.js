let records = [];
let currentSort = 'recent';

document.addEventListener('DOMContentLoaded', function () {
    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', function () {
        currentSort = this.value;
        sortRecords();
        renderRecords();
    });

    loadRecords();
});

function loadRecords() {
    const messageEl = document.getElementById('records-message');
    const gridEl = document.getElementById('records-grid');

    messageEl.style.display = 'none';
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
                messageEl.className = 'records-empty';
                messageEl.style.display = 'block';
                return;
            }

            sortRecords();
            renderRecords();
        })
        .catch(error => {
            console.error('Error loading records.csv:', error);
            messageEl.textContent = 'Error loading record data. Make sure records.csv is in this folder and accessible.';
            messageEl.className = 'records-error';
            messageEl.style.display = 'block';
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
    messageEl.style.display = 'none';

    if (!records || !records.length) {
        messageEl.textContent = 'No records to display.';
        messageEl.className = 'records-empty';
        messageEl.style.display = 'block';
        return;
    }

    let html = '';
    records.forEach(record => {
        const title = escapeHtml(record.title || 'Untitled');
        const artist = escapeHtml(record.artist || 'Unknown Artist');
        const year = record.year ? record.year : '—';
        const imgUrl = record.imageUrl || '../images/placeholder-album.png';


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
        <div class="record-card">
            <img src="${imgUrl}" alt="${title} album art" onerror="this.src='../images/placeholder-album.png';">
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
        </div>
    `;
    });

    gridEl.innerHTML = html;
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
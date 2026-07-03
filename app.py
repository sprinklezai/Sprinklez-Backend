import streamlit as st
import pandas as pd
import plotly.express as px

# -----------------------------------------------------------------------------
# 1. PAGE SETUP & EXACT VISUAL THEME
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Group Company Profile",
    page_icon="🏢",
    layout="wide"
)

# Custom styling to recreate the off-white minimalist palette from image_0497e9.png
st.markdown("""
<style>
    /* Global background color */
    .stApp { background-color: #FAF8F5; font-family: 'Inter', sans-serif; }
    
    /* Top Header Meta Styling */
    .header-tag { font-size: 0.75rem; font-weight: 700; color: #9A3412; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px; }
    .header-main { font-family: 'Georgia', serif; font-size: 2.25rem; font-weight: 700; color: #1E293B; margin-top: 0px; margin-bottom: 2px; }
    .header-sub { font-size: 0.85rem; color: #64748B; margin-bottom: 20px; }
    
    /* Filter Panel Container */
    .filter-box {
        background-color: #FCFAF7;
        border: 1px solid #EADCC9;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
    }
    .filter-label { font-size: 0.7rem; font-weight: bold; color: #78350F; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }

    /* KPI Cards Styling */
    .kpi-card {
        background-color: #FAF8F5;
        border: 1px solid #EADCC9;
        border-radius: 8px;
        padding: 20px;
        min-height: 140px;
    }
    .kpi-label { font-size: 0.75rem; font-weight: 700; color: #78716C; letter-spacing: 1px; text-transform: uppercase; }
    .kpi-value-stores { font-family: 'Georgia', serif; font-size: 3rem; color: #7F1D1D; font-weight: 700; margin: 5px 0; }
    .kpi-value-brands { font-family: 'Georgia', serif; font-size: 3rem; color: #B45309; font-weight: 700; margin: 5px 0; }
    .kpi-value-companies { font-family: 'Georgia', serif; font-size: 3rem; color: #1C1917; font-weight: 700; margin: 5px 0; }
    .kpi-value-countries { font-family: 'Georgia', serif; font-size: 3rem; color: #14532D; font-weight: 700; margin: 5px 0; }
    .kpi-subtext { font-size: 0.8rem; color: #78716C; }

    /* Block Sections */
    .section-container {
        background-color: #FCFAF7;
        border: 1px solid #EADCC9;
        border-radius: 12px;
        padding: 20px;
    }
    .section-header { font-size: 0.8rem; font-weight: 700; color: #78716C; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid #EADCC9; padding-bottom: 6px;}
</style>
""", unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# 2. REMOTE DATA RETRIEVAL (LIVE COUPLING REPO DATA)
# -----------------------------------------------------------------------------
@st.cache_data
def fetch_live_sheets():
    try:
        # Load from local Excel files
        stores = pd.read_excel("Store_Master.xlsx")
        brands = pd.read_excel("Brand_Master.xlsx")
        companies = pd.read_excel("Company_Master.xlsx")
        countries = pd.read_excel("Country_Master.xlsx")
        
        # Clean column spaces and force uppercase mapping
        for df in [stores, brands, companies, countries]:
            df.columns = df.columns.str.strip().str.upper()
        return stores, brands, companies, countries
    except Exception:
        # Fallbacks explicitly typed to match required upper-case constraints
        m_stores = pd.DataFrame({
            'STORE NO': ['3133', '4336', '5742', '11010', '11935', '12033', '12156'],
            'STORE NAME': ['CSC MALL OF QATAR', 'JMP JLT', 'SLI JLT', 'CSC ABUDHABI MALL', 'CSC ARABIAN RANCHES', 'CSC CENTURY MALL FUJAIRAH', 'CSC ABUDHABI CORNICHE'],
            'MALL': ['Mall Of Qatar', 'Cluster R JLT', 'JLT - Cluster R', 'Abu Dhabi Mall', 'Arabian Ranches', 'Century Mall', 'Abudhabi Corniche'],
            'BRAND': ['CSC', 'JMP', 'SLI', 'CSC', 'CSC', 'CSC', 'CSC'],
            'COUNTRY': ['QA', 'AE', 'AE', 'AE', 'AE', 'AE', 'AE'],
            'COMPANY': ['Apparel Qatar WLL', 'Sprinklez LLC', 'Savour LLC', 'Sprinklez LLC', 'Sprinklez LLC', 'Sprinklez LLC', 'Sprinklez LLC'],
            'STATUS': ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE']
        })
        m_brands = pd.DataFrame({'BRAND': ['ALB', 'CSC', 'JMP', 'JMT', 'MCC', 'NAN', 'SLI', 'WSP']})
        m_companies = pd.DataFrame({'COMPANY': ['Apparel International LLC', 'Sprinklez WLL', 'Apparel Qatar WLL', 'Apparel Limited', 'Sprinklez LLC', 'Savour LLC', 'Sprinklez For Restaurant Management WLL']})
        m_countries = pd.DataFrame({'COUNTRY': ['OM', 'BH', 'QA', 'SA', 'AE', 'KW']})
        return m_stores, m_brands, m_companies, m_countries

raw_stores, raw_brands, raw_companies, raw_countries = fetch_live_sheets()

# -----------------------------------------------------------------------------
# 3. GLOBAL TOP HEADER PANEL
# -----------------------------------------------------------------------------
col_h1, col_h2 = st.columns([4, 1])
with col_h1:
    st.markdown('<p class="header-tag">Group Operations · F&B Portfolio</p>', unsafe_allow_html=True)
    st.markdown('<p class="header-main">Group Company Profile</p>', unsafe_allow_html=True)
    st.markdown('<p class="header-sub">All companies · all countries · all brands</p>', unsafe_allow_html=True)
with col_h2:
    st.write("")
    if st.button("🔄 Refresh data", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

# -----------------------------------------------------------------------------
# 4. SLICERS FILTER CONTROL (INTERACTIVE SLICER REGION)
# -----------------------------------------------------------------------------
st.markdown('<div class="filter-box">', unsafe_allow_html=True)
fil_col1, fil_col2, fil_col3 = st.columns(3)

# Bulletproof fallback collection strategies if columns differ across individual sheets
company_list = sorted(list(raw_stores["COMPANY"].unique())) if "COMPANY" in raw_stores.columns and not raw_stores.empty else (sorted(list(raw_companies["COMPANY"].unique())) if "COMPANY" in raw_companies.columns else [])
country_list = sorted(list(raw_stores["COUNTRY"].unique())) if "COUNTRY" in raw_stores.columns and not raw_stores.empty else (sorted(list(raw_countries["COUNTRY"].unique())) if "COUNTRY" in raw_countries.columns else [])
brand_list = sorted(list(raw_stores["BRAND"].unique())) if "BRAND" in raw_stores.columns and not raw_stores.empty else (sorted(list(raw_brands["BRAND"].unique())) if "BRAND" in raw_brands.columns else [])

with fil_col1:
    st.markdown('<p class="filter-label">Company</p>', unsafe_allow_html=True)
    selected_companies = st.multiselect("Select Company", company_list, default=company_list, label_visibility="collapsed")
with fil_col2:
    st.markdown('<p class="filter-label">Country</p>', unsafe_allow_html=True)
    selected_countries = st.multiselect("Select Country", country_list, default=country_list, label_visibility="collapsed")
with fil_col3:
    st.markdown('<p class="filter-label">Brand</p>', unsafe_allow_html=True)
    selected_brands = st.multiselect("Select Brand", brand_list, default=brand_list, label_visibility="collapsed")
st.markdown('</div>', unsafe_allow_html=True)

# Safe matching execution logic against master data store tracking frame
if not raw_stores.empty:
    filtered_df = raw_stores[
        (raw_stores['COMPANY'].isin(selected_companies) if 'COMPANY' in raw_stores.columns else True) & 
        (raw_stores['COUNTRY'].isin(selected_countries) if 'COUNTRY' in raw_stores.columns else True) & 
        (raw_stores['BRAND'].isin(selected_brands) if 'BRAND' in raw_stores.columns else True)
    ]
else:
    filtered_df = pd.DataFrame()

# -----------------------------------------------------------------------------
# 5. DYNAMIC STRUCTURED KPI BLOCKS
# -----------------------------------------------------------------------------
kpi_1, kpi_2, kpi_3, kpi_4 = st.columns(4)

with kpi_1:
    active_count = len(filtered_df[filtered_df['STATUS'] == 'ACTIVE']) if 'STATUS' in filtered_df.columns else len(filtered_df)
    inactive_count = len(filtered_df[filtered_df['STATUS'] != 'ACTIVE']) if 'STATUS' in filtered_df.columns else 0
    st.markdown(f'''
        <div class="kpi-card">
            <p class="kpi-label">Total Stores</p>
            <p class="kpi-value-stores">{len(filtered_df)}</p>
            <p class="kpi-subtext">{active_count} active · {inactive_count} inactive</p>
        </div>
    ''', unsafe_allow_html=True)

with kpi_2:
    unique_brands = filtered_df['BRAND'].nunique() if 'BRAND' in filtered_df.columns else 0
    st.markdown(f'''
        <div class="kpi-card">
            <p class="kpi-label">Total Brands</p>
            <p class="kpi-value-brands">{unique_brands}</p>
            <p class="kpi-subtext">operated in selection</p>
        </div>
    ''', unsafe_allow_html=True)

with kpi_3:
    unique_cos = filtered_df['COMPANY'].nunique() if 'COMPANY' in filtered_df.columns else 0
    st.markdown(f'''
        <div class="kpi-card">
            <p class="kpi-label">Total Companies</p>
            <p class="kpi-value-companies">{unique_cos}</p>
            <p class="kpi-subtext">legal entities</p>
        </div>
    ''', unsafe_allow_html=True)

with kpi_4:
    unique_countries = filtered_df['COUNTRY'].nunique() if 'COUNTRY' in filtered_df.columns else 0
    country_string = ", ".join(filtered_df['COUNTRY'].unique()) if 'COUNTRY' in filtered_df.columns and len(filtered_df) > 0 else "None"
    st.markdown(f'''
        <div class="kpi-card">
            <p class="kpi-label">Countries</p>
            <p class="kpi-value-countries">{unique_countries}</p>
            <p class="kpi-subtext" style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">{country_string}</p>
        </div>
    ''', unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# 6. STORE DIRECTORY TABLE & COUNTRY DONUT CHART
# -----------------------------------------------------------------------------
body_col1, body_col2 = st.columns([3, 2])

with body_col1:
    st.markdown('<div class="section-container">', unsafe_allow_html=True)
    st.markdown('<p class="section-header">Store Directory</p>', unsafe_allow_html=True)
    
    search_query = st.text_input("Search bar", placeholder="Search store, mall, brand, or company...", label_visibility="collapsed")
    if search_query and not filtered_df.empty:
        filter_mask = pd.Series(False, index=filtered_df.index)
        for col in ['STORE NAME', 'MALL', 'BRAND']:
            if col in filtered_df.columns:
                filter_mask |= filtered_df[col].astype(str).str.contains(search_query, case=False, na=False)
        filtered_df = filtered_df[filter_mask]
        
    # Render available visible columns dynamically to prevent frame render faults
    display_cols = [c for c in ['STORE NO', 'STORE NAME', 'MALL', 'BRAND', 'COUNTRY', 'COMPANY', 'STATUS'] if c in filtered_df.columns]
    st.dataframe(filtered_df[display_cols] if not filtered_df.empty else filtered_df, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)

with body_col2:
    st.markdown('<div class="section-container">', unsafe_allow_html=True)
    st.markdown('<p class="section-header">Stores by Country</p>', unsafe_allow_html=True)
    
    if not filtered_df.empty and 'COUNTRY' in filtered_df.columns:
        donut_data = filtered_df['COUNTRY'].value_counts().reset_index()
        donut_data.columns = ['Country', 'Count']
        
        color_palette = ['#451A03', '#78350F', '#9A3412', '#1E3A8A', '#3B82F6', '#10B981']
        
        fig_donut = px.pie(
            donut_data, 
            values='Count', 
            names='Country', 
            hole=0.6,
            color_discrete_sequence=color_palette
        )
        fig_donut.update_layout(
            showlegend=True,
            legend=dict(orientation="v", yanchor="bottom", y=0.1, xanchor="left", x=0.05),
            margin=dict(t=10, b=10, l=10, r=10),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
        st.plotly_chart(fig_donut, use_container_width=True, config={'displayModeBar': False})
    else:
        st.info("No data points available for current slice parameters.")
    st.markdown('</div>', unsafe_allow_html=True)

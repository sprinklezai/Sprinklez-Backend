from pathlib import Path

import streamlit as st
import pandas as pd
import plotly.express as px

st.set_page_config(
    page_title="Group Company Profile",
    page_icon="🏢",
    layout="wide",
)

st.markdown(
    """
    <style>
        .stApp { background-color: #FAF8F5; font-family: 'Inter', sans-serif; }
        .header-tag { font-size: 0.75rem; font-weight: 700; color: #9A3412; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px; }
        .header-main { font-family: 'Georgia', serif; font-size: 2.25rem; font-weight: 700; color: #1E293B; margin-top: 0px; margin-bottom: 2px; }
        .header-sub { font-size: 0.85rem; color: #64748B; margin-bottom: 20px; }
        .filter-box {
            background-color: #FCFAF7;
            border: 1px solid #EADCC9;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
        }
        .filter-label { font-size: 0.7rem; font-weight: bold; color: #78350F; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
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
        .section-container {
            background-color: #FCFAF7;
            border: 1px solid #EADCC9;
            border-radius: 12px;
            padding: 20px;
        }
        .section-header { font-size: 0.8rem; font-weight: 700; color: #78716C; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid #EADCC9; padding-bottom: 6px; }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data(show_spinner=False)
def fetch_live_sheets():
    try:
        stores = pd.read_excel("Store_Master.xlsx")
        brands = pd.read_excel("Brand_Master.xlsx")
        companies = pd.read_excel("Company_Master.xlsx")
        countries = pd.read_excel("Country_Master.xlsx")

        for df in [stores, brands, companies, countries]:
            df.columns = [str(col).strip() for col in df.columns]
        return stores, brands, companies, countries
    except Exception:
        stores = pd.DataFrame(
            {
                "STORE NO": ["3133", "4336", "5742", "11010", "11935", "12033", "12156"],
                "STORE NAME": ["CSC MALL OF QATAR", "JMP JLT", "SLI JLT", "CSC ABUDHABI MALL", "CSC ARABIAN RANCHES", "CSC CENTURY MALL FUJAIRAH", "CSC ABUDHABI CORNICHE"],
                "MALL": ["Mall Of Qatar", "Cluster R JLT", "JLT - Cluster R", "Abu Dhabi Mall", "Arabian Ranches", "Century Mall", "Abudhabi Corniche"],
                "BRAND": ["Coldstone Creamery", "Jamies Pizzeria", "Sushi Library", "Coldstone Creamery", "Coldstone Creamery", "Coldstone Creamery", "Coldstone Creamery"],
                "COUNTRY": ["QA", "AE", "AE", "AE", "AE", "AE", "AE"],
                "COMPANY": ["Apparel Qatar WLL", "Sprinklez LLC", "Savour LLC", "Sprinklez LLC", "Sprinklez LLC", "Sprinklez LLC", "Sprinklez LLC"],
                "STATUS": ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"],
            }
        )
        brands = pd.DataFrame({"BRAND": ["ALB", "CSC", "JMP", "JMT", "MCC", "NAN", "SLI", "WSP"], "BRAND_NAME": ["Allo Beirut", "Coldstone Creamery", "Jamies Pizzeria", "Jamies Italian", "Molten Chocolate Cafe", "Nando's", "Sushi Library", "Wingstop"]})
        companies = pd.DataFrame({"COMPANY": ["Apparel International LLC", "Sprinklez WLL", "Apparel Qatar WLL", "Apparel Limited", "Sprinklez LLC", "Savour LLC", "Sprinklez For Restaurant Management WLL"]})
        countries = pd.DataFrame({"COUNTRY": ["OM", "BH", "QA", "SA", "AE", "KW"], "STORES_COUNT": [12, 17, 20, 88, 71, 17]})
        return stores, brands, companies, countries


raw_stores, raw_brands, raw_companies, raw_countries = fetch_live_sheets()

col_h1, col_h2 = st.columns([4, 1])
with col_h1:
    st.markdown('<p class="header-tag">Group Operations · F&B Portfolio</p>', unsafe_allow_html=True)
    st.markdown('<p class="header-main">Group Company Profile</p>', unsafe_allow_html=True)
    st.markdown('<p class="header-sub">All companies · all countries · all brands</p>', unsafe_allow_html=True)
with col_h2:
    if st.button("🔄 Refresh data", use_container_width=True):
        st.cache_data.clear()

st.markdown('<div class="filter-box">', unsafe_allow_html=True)
fil_col1, fil_col2, fil_col3 = st.columns(3)

company_list = sorted(list(raw_stores["COMPANY"].unique())) if not raw_stores.empty and "COMPANY" in raw_stores.columns else list(raw_companies["COMPANY"].unique())
country_list = sorted(list(raw_stores["COUNTRY"].unique())) if not raw_stores.empty and "COUNTRY" in raw_stores.columns else list(raw_countries["COUNTRY"].unique())
brand_list = sorted(list(raw_stores["BRAND"].unique())) if not raw_stores.empty and "BRAND" in raw_stores.columns else list(raw_brands["BRAND"].unique())

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

filtered_df = raw_stores.copy()
if not filtered_df.empty:
    filtered_df = filtered_df[
        (filtered_df["COMPANY"].isin(selected_companies))
        & (filtered_df["COUNTRY"].isin(selected_countries))
        & (filtered_df["BRAND"].isin(selected_brands))
    ]

kpi_1, kpi_2, kpi_3, kpi_4 = st.columns(4)

with kpi_1:
    active_count = len(filtered_df[filtered_df["STATUS"] == "ACTIVE"]) if not filtered_df.empty and "STATUS" in filtered_df.columns else len(filtered_df)
    inactive_count = len(filtered_df[filtered_df["STATUS"] != "ACTIVE"]) if not filtered_df.empty and "STATUS" in filtered_df.columns else 0
    st.markdown(
        f"""
        <div class="kpi-card">
            <p class="kpi-label">Total Stores</p>
            <p class="kpi-value-stores">{len(filtered_df)}</p>
            <p class="kpi-subtext">{active_count} active · {inactive_count} inactive</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_2:
    unique_brands = filtered_df["BRAND"].nunique() if not filtered_df.empty else 0
    st.markdown(
        f"""
        <div class="kpi-card">
            <p class="kpi-label">Total Brands</p>
            <p class="kpi-value-brands">{unique_brands}</p>
            <p class="kpi-subtext">operated in selection</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_3:
    unique_cos = filtered_df["COMPANY"].nunique() if not filtered_df.empty else 0
    st.markdown(
        f"""
        <div class="kpi-card">
            <p class="kpi-label">Total Companies</p>
            <p class="kpi-value-companies">{unique_cos}</p>
            <p class="kpi-subtext">legal entities</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_4:
    unique_countries = filtered_df["COUNTRY"].nunique() if not filtered_df.empty else 0
    country_string = ", ".join(filtered_df["COUNTRY"].astype(str).unique()) if not filtered_df.empty else "None"
    st.markdown(
        f"""
        <div class="kpi-card">
            <p class="kpi-label">Countries</p>
            <p class="kpi-value-countries">{unique_countries}</p>
            <p class="kpi-subtext" style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">{country_string}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("<br>", unsafe_allow_html=True)

body_col1, body_col2 = st.columns([3, 2])

with body_col1:
    st.markdown('<div class="section-container">', unsafe_allow_html=True)
    st.markdown('<p class="section-header">Store Directory</p>', unsafe_allow_html=True)

    search_query = st.text_input("Search bar", placeholder="Search store, mall, brand, or company...", label_visibility="collapsed")
    if search_query:
        filtered_df = filtered_df[
            filtered_df["STORE NAME"].astype(str).str.contains(search_query, case=False, na=False)
            | filtered_df["MALL"].astype(str).str.contains(search_query, case=False, na=False)
            | filtered_df["BRAND"].astype(str).str.contains(search_query, case=False, na=False)
        ]

    display_cols = [col for col in ["STORE NO", "STORE NAME", "MALL", "BRAND", "COUNTRY", "COMPANY", "STATUS"] if col in filtered_df.columns]
    st.dataframe(filtered_df[display_cols] if not filtered_df.empty else filtered_df, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)

with body_col2:
    st.markdown('<div class="section-container">', unsafe_allow_html=True)
    st.markdown('<p class="section-header">Stores by Country</p>', unsafe_allow_html=True)

    if not filtered_df.empty:
        donut_data = filtered_df["COUNTRY"].value_counts().reset_index()
        donut_data.columns = ["Country", "Count"]
        color_palette = ["#451A03", "#78350F", "#9A3412", "#1E3A8A", "#3B82F6", "#10B981"]
        fig_donut = px.pie(
            donut_data,
            values="Count",
            names="Country",
            hole=0.6,
            color_discrete_sequence=color_palette,
        )
        fig_donut.update_layout(
            showlegend=True,
            legend=dict(orientation="v", yanchor="bottom", y=0.1, xanchor="left", x=0.05),
            margin=dict(t=10, b=10, l=10, r=10),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig_donut, use_container_width=True, config={"displayModeBar": False})
    else:
        st.info("No data available for selected filter configurations.")
    st.markdown('</div>', unsafe_allow_html=True)

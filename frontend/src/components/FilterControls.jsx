import React from "react";

export default function FilterControls({
  searchTerm,
  setSearchTerm,
  dateFilter,
  setDateFilter,
  sortOrder,
  setSortOrder,
  handleFilterInteraction,
}) {
  return (
    <div className="filter-controls">
      <input
        type="text"
        placeholder="Search files..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          handleFilterInteraction();
        }}
      />
      <select
        value={dateFilter}
        onChange={(e) => {
          setDateFilter(e.target.value);
          handleFilterInteraction();
        }}
      >
        <option value="">Select time period</option>
        <option value="all">All time</option>
        <option value="today">Today</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="year">This year</option>
      </select>
      <select
        value={sortOrder}
        onChange={(e) => {
          setSortOrder(e.target.value);
          handleFilterInteraction();
        }}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </div>
  );
}
